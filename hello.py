from langfuse.decorators import observe
from langfuse.openai import openai
import os

# Langfuseのエラーイベントリスナーは現在Python SDKには提供されていないが、
# 今後追加される可能性があるため print による補足を入れる。

@observe()
def story():
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            max_tokens=100,
            messages=[
                {"role": "system", "content": "You are a great storyteller."},
                {"role": "user", "content": "Once upon a time in a galaxy far, far away..."}
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        print("❌ Error in story():", e)
        raise

@observe()
def main():
    try:
        return story()
    except Exception as e:
        print("❌ Error in main():", e)

if __name__ == "__main__":
    main()
    # 明示的にLangfuseログをフラッシュ（短命プロセス向け）
    openai.flush_langfuse()
