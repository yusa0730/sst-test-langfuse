### sst-test-langfuse

#### 前提条件
- Node.js v22.11.0
- pnpm がインストールされていること (`npm install -g pnpm`)
- AWS CLI が設定済みであること（`aws configure` または `AWS_PROFILE` 環境変数）

#### 構築手順

- pnpm install
- sst deploy --stage production

#### langfuse確認URL
以下はAWS管理画面コンソールのALBのAレコードの例
- http://sst-test-langfuse-alb-production-150477180.ap-northeast-1.elb.amazonaws.com

### langfuse用のスクリプトを実行する方法
- langfuseの管理画面UIで以下を実行する
```
Organization作成->project名作成->最後に API Keys を選択の上、Create new API Keysを押下します
```

- 上記を行うとSecretキーとPublicキー、Host名の払い出しがされるのでローカル環境で以下を実行し環境変数の設定を行う
```
export LANGFUSE_SECRET_KEY="YOUR_SECRET_KEY"
export LANGFUSE_PUBLIC_KEY="YOUR_PUBLIC_KEY"
export LANGFUSE_HOST="YOUR_LANGFUSE_URL"
export OPENAI_API_KEY="OPENAI_API_KEY"
```

- 以下コマンドでスクリプトを実行
```
uv run hello.py
```

- 参考資料
https://kiririmode.hatenablog.jp/entry/20250106/1736142208