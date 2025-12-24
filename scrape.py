from contextlib import contextmanager
from dataclasses import dataclass
import datetime
from email.utils import parsedate_to_datetime
import json
import os
from pathlib import Path
import time
from typing import Any
from urllib.parse import urlencode, urlparse, parse_qs
from playwright.sync_api import sync_playwright, Response
from pydantic import BaseModel
import requests
from cryptography.fernet import Fernet
import logging


class Attachment(BaseModel):
    tweet_id: str
    type: str
    url: str

    def make_local_filename(self):
        return f"{self.tweet_id}.{self.type}.{self.url.rsplit('/', 1)[1]}"


class Tweet(BaseModel):
    id: str
    username: str
    attachments: list[Attachment]
    raw_data: dict
    created_at: datetime.datetime


@dataclass
class PaginatedResult:
    tweets: list[Tweet]
    pagination_state: Any


def is_graphql_tweets_response(response: Response):
    return 'graphql' in response.url and '/UserTweetsAndReplies?' in response.url


@contextmanager
def storage_state_encryption(
        storage_state_path: Path,
        encryption_key: str,
):
    f = Fernet(encryption_key)
    encrypted_storage_state_path = Path(str(storage_state_path) + ".enc")
    if encrypted_storage_state_path.exists():
        decrypted_data = f.decrypt(encrypted_storage_state_path.read_bytes())
        storage_state_path.write_bytes(decrypted_data)

    try:
        yield
    finally:
        if storage_state_path.exists():
            new_data = storage_state_path.read_bytes()
            encrypted_data = f.encrypt(new_data)
            encrypted_storage_state_path.write_bytes(encrypted_data)
            storage_state_path.unlink()


class TwitterDownloader:
    def __init__(
            self,
            playwright_initial_cookies: str,
            data_dir: Path,
    ):
        self.inital_cookies = playwright_initial_cookies
        self.storage_state_path = data_dir / "playwright_state.json"
        self._page = None

    def _get_storage_state(self):
        if self.storage_state_path.exists():
            return self.storage_state_path
        
        def parse_cookie_kv(c: str):
            k, v = c.strip().split('=', 1)
            return {
                "name": k,
                "value": v,
                "domain": ".twitter.com",
                "path": "/",
                "expires": time.time() + 60*60*24*365*10,
            }

        return {
            "cookies": [parse_cookie_kv(c) for c in self.inital_cookies.split(';')]
        }
    
    @contextmanager
    def open(self):
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(storage_state=self._get_storage_state())
            self._page = page
            yield
            self._page = None
            page.context.storage_state(path=self.storage_state_path)
            browser.close()

    def get_posts(
            self,
            username: str,
            pagination_state = None,
    ):
        page = self._page
        if pagination_state is None:
            url = f"https://twitter.com/{username}/with_replies"
            logging.info(f"downloading from {url}")
            with page.expect_response(is_graphql_tweets_response) as response:
                page.goto(url)
            response = response.value
            headers = response.request.headers
        else:
            url, headers = pagination_state
            logging.info("downloading from api")
            response = page.request.get(url, headers=headers, fail_on_status_code=True)

        api_url = response.url
        body = response.json()

        next_cursor = None
        tweets = []
        for instruction in body["data"]["user"]["result"]["timeline"]["timeline"]["instructions"]:
            if instruction["type"] != "TimelineAddEntries": continue
            for entry in instruction["entries"]:
                raw_tweets = []

                if entry["content"]["__typename"] == "TimelineTimelineCursor" and entry["content"]["cursorType"] == "Bottom":
                    next_cursor = entry["content"]["value"]

                if entry["content"]["__typename"] == "TimelineTimelineItem":
                    raw_tweets.append(entry["content"]["itemContent"]["tweet_results"]["result"])
                
                if entry["content"]["__typename"] == "TimelineTimelineModule":
                    for item in entry["content"]["items"]:
                        if item["item"]["itemContent"]["__typename"] == "TimelineTweet":
                            raw_tweets.append(item["item"]["itemContent"]["tweet_results"]["result"])

                for raw_tweet in raw_tweets:
                    if raw_tweet["__typename"] == "TweetWithVisibilityResults":
                        raw_tweet = raw_tweet["tweet"]

                    attachments = []
                    for media in raw_tweet["legacy"].get("extended_entities", {}).get("media", []):
                        attachments.append(Attachment(
                            tweet_id=raw_tweet["rest_id"],
                            type=media["type"],
                            url=media["media_url_https"],
                        ))
                    screen_name = raw_tweet["core"]["user_results"]["result"]["core"]["screen_name"]
                    if screen_name != username:
                        logging.info(f"skipping tweet {raw_tweet["rest_id"]} from {screen_name}")
                        continue
                    tweets.append(Tweet(
                        id=raw_tweet["rest_id"],
                        username=screen_name,
                        attachments=attachments,
                        raw_data=raw_tweet,
                        created_at=parsedate_to_datetime(raw_tweet["legacy"]["created_at"]),
                    ))
        
        parsed = urlparse(api_url)
        query = parse_qs(parsed.query)
        variables = json.loads(query["variables"][0])
        variables["cursor"] = next_cursor
        query["variables"] = [json.dumps(variables)]
        next_api_url = parsed._replace(query=urlencode(query, doseq=True)).geturl()
        return PaginatedResult(tweets=tweets, pagination_state=(next_api_url, headers))


class TweetRepository:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
    
    def get(self, username: str, tweet_id: str) -> Tweet | None:
        user_dir = self.data_dir / "posts" / "x" / username
        tweet_path = user_dir / f"{tweet_id}.json"
        if not tweet_path.exists():
            return None
        with open(tweet_path, 'r') as f:
            return Tweet.model_validate_json(f.read())

    def put(self, tweet: Tweet):
        user_dir = self.data_dir / "posts" / "x" / tweet.username
        user_dir.mkdir(parents=True, exist_ok=True)
        tweet_path = user_dir / f"{tweet.id}.json"
        tweet_path.write_text(tweet.model_dump_json(indent=2))


class DownloadTask:
    def __init__(
            self,
            data_dir: Path,
            tweet_repo: TweetRepository,
            twitter_downloader: TwitterDownloader,
    ):
        self.data_dir = data_dir
        self.tweet_repo = tweet_repo
        self.twitter_downloader = twitter_downloader

    def handle(self, account: dict, pages: int | None = None):
        new_tweets, old_tweets = self._get_new_tweets(account["x"]["screen_name"], pages)
        new_tweets.reverse()  # to save old likes first
        if account["x"].get("download_images", True):
            self._download_images(new_tweets)

        for tweet in new_tweets:
            self.tweet_repo.put(tweet)
        
        if old_tweets:
            user_result = old_tweets[0].raw_data["core"]["user_results"]["result"]
            account["x"]["name"] = user_result["core"]["name"]
            account["x"]["description"] = user_result["legacy"]["description"]
            account["x"]["profile_image_url_https"] = user_result["avatar"]["image_url"]

    def _get_new_tweets(self, username: str, pages: int | None = None):
        page_count = 0
        new_tweets = []
        old_tweets = []
        pagination_state = None

        while pages is None or page_count < pages:
            result = self.twitter_downloader.get_posts(username=username, pagination_state=pagination_state)
            if not result.tweets:
                logging.info("no more tweets")
                break

            page_count += 1
            pagination_state = result.pagination_state

            found_saved = False
            for tweet in result.tweets:
                if self.tweet_repo.get(tweet.username, tweet.id):
                    logging.info(f"saved tweet found: {tweet.id}")
                    found_saved = True
                    old_tweets.append(tweet)
                else:
                    new_tweets.append(tweet)
            
            if found_saved and pages is None:
                break
        
        return new_tweets, old_tweets

    def _download_images(self, tweets: list[Tweet]) -> list[tuple[Tweet, Attachment]]:
        result = []
        for tweet in tweets:
            for attachment in tweet.attachments:
                download_path = self.data_dir / "posts" / "x" / tweet.username / attachment.make_local_filename()
                download_path.parent.mkdir(parents=True, exist_ok=True)
                if download_path.exists():
                    logging.info(f"already exists: {download_path.name}")
                else:
                    r = requests.get(attachment.url)
                    # if not r.ok:
                    #     logging.info(f"error: {r.status_code, download_path.name}")
                    #     continue
                    r.raise_for_status()
                    download_path.write_bytes(r.content)
                result.append((tweet, attachment))
        return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    from dotenv import load_dotenv
    load_dotenv()

    data_dir = Path("./data")
    downloader = TwitterDownloader(
        playwright_initial_cookies="",
        data_dir=data_dir,
    )
    tweet_repo = TweetRepository(data_dir=data_dir)
    task = DownloadTask(data_dir=data_dir, tweet_repo=tweet_repo, twitter_downloader=downloader)

    accounts = json.loads((data_dir / "accounts.json").read_text())

    with storage_state_encryption(
            storage_state_path=downloader.storage_state_path,
            encryption_key=os.environ["ENCRYPT_KEY"],
    ):
        with downloader.open():
            for account in accounts:
                username = account["x"]["screen_name"]
                logging.info(f"downloading {username}")
                task.handle(account)

    (data_dir / "accounts.json").write_text(json.dumps(accounts, indent=2, ensure_ascii=False))
