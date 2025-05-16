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