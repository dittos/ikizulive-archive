import json
import logging
import os
from pathlib import Path
from openai import OpenAI

languages = [("ko", "Korean")]


def translate_post(client: OpenAI, posts_dir: Path, post_id: str, lang: str):
    post_path = posts_dir / f"{post_id}.json"
    translated_post_path = posts_dir / f"{post_id}.{lang}.json"

    if translated_post_path.exists():
        return

    logging.info(f"[translate] {str(post_path)} {lang=}")

    # Read the original post
    post = json.loads(post_path.read_text())
    text = post["raw_data"]["legacy"]["full_text"]

    lang_name = [l for l, n in languages if l == lang][0]

    resp = client.chat.completions.create(
        model="gemini-2.0-flash",
        messages=[
            {
                "role": "system",
                "content": f"""You are a helpful assistant that translates text to {lang_name}.
Your task is to translate the text provided by the user into {lang_name} while preserving the original meaning and context. You should not add any additional information or change the tone of the text. Please ensure that the translation is accurate and natural-sounding in {lang_name}.
""",
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
        username = account["x"]
        logging.info(f"account: {username}")
        posts_dir = data_dir / "posts" / "x" / username
        for filename in os.listdir(posts_dir):
            if filename.endswith(".json"):
                post_id = filename.replace(".json", "")
                if "." in post_id:
                    # translated file
                    continue
                for lang, _ in languages:
                    translate_post(client, posts_dir, post_id, lang)
