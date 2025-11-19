import json
import logging
import os
from pathlib import Path
from openai import OpenAI, APIError

languages = {
    "ko": {
        "language_name": "Korean",
        "custom_prompt": """'イキヅライブ'(모두 가타가나)는 '이키즈라이브'로 번역
'いきづらい部'는 '살기힘든부'로 번역
'LOVELIVE! BLUEBIRD'는 영문 그대로 유지

사람 이름 읽는 법:
高橋ポルカ -> 타카하시 폴카
麻布麻衣 -> 아자부 마이
五桐 玲 -> 고토 아키라
駒形花火 -> 코마가타 하나비
金澤奇跡 -> 카나자와 미라클
調布のりこ -> 쵸후 노리코
春宮ゆくり -> 하루미야 유쿠리
此花輝夜 -> 코노하나 오로라
山田真緑 -> 야마다 미도리
佐々木翔音 -> 사사키 시온
"""
    }
}


def translate_post(client: OpenAI, posts_dir: Path, post_id: str, lang: str, force: bool = False):
    post_path = posts_dir / f"{post_id}.json"
    translated_post_path = posts_dir / f"{post_id}.{lang}.json"

    if not force and translated_post_path.exists():
        return

    logging.info(f"[translate] {str(post_path)} {lang=}")

    # Read the original post
    post = json.loads(post_path.read_text())
    text = post["raw_data"]["legacy"]["full_text"]

    lang_info = languages[lang]
    lang_name = lang_info["language_name"]
    custom_prompt = lang_info["custom_prompt"]

    system_prompt = f"""You are a helpful assistant that translates text to {lang_name}.
Your task is to translate the text provided by the user into {lang_name} while preserving the original meaning and context. You should not add any additional information or change the tone of the text. Please ensure that the translation is accurate and natural-sounding in {lang_name}.

{custom_prompt}"""
    resp = client.chat.completions.create(
        model="gemini-2.5-flash",
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": f"Translate the following text to {lang_name}:\n\n{text}",
            }
        ],
        temperature=0.2,
    )
    translated_text = resp.choices[0].message.content

    # Write the translated post
    translated_post_path.write_text(
        json.dumps(
            {
                "id": post["id"],
                "translated_text": translated_text,
                "lang": lang,
                "system_prompt": system_prompt,
                "raw_data": resp.model_dump(mode="json"),
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    from dotenv import load_dotenv
    load_dotenv()

    client = OpenAI(
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    data_dir = Path("./data")
    accounts = json.loads((data_dir / "accounts.json").read_text())

    for account in accounts:
        username = account["x"]["screen_name"]
        logging.info(f"account: {username}")
        posts_dir = data_dir / "posts" / "x" / username
        for filename in os.listdir(posts_dir):
            if filename.endswith(".json"):
                post_id = filename.replace(".json", "")
                if "." in post_id:
                    # translated file
                    continue
                for lang in languages:
                    try:
                        translate_post(client, posts_dir, post_id, lang)
                    except APIError as e:
                        # exit properly to save translated files so far on model overloaded error
                        if e.status_code in (429, 503):
                            logging.exception("stop translating due to model overloaded error")
                            raise SystemExit
                        raise
