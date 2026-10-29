# Daken Dojo Duel (DDD)

タッチタイピングを鍛える練習ゲームです。瓦割り（訓練）、連撃（耐久）、格闘（実戦）の3モードと、段位・成長記録・四天王（上位4名）があります。

| ファイル | 役割 |
|---|---|
| `app.py` | Streamlit の入口（ゲームを画面いっぱいに表示） |
| `game/index.html` | ゲーム本体（1ファイルで完結） |
| `gas/Code.gs` | 記録・四天王を受け付ける Google Apps Script |

## 手元で動かす

```
pip install -r requirements.txt
streamlit run app.py
```

## 四天王（ランキング）

`gas/Code.gs` を新しいスプレッドシートに紐づけた Apps Script にコピーし、ウェブアプリとしてデプロイします（実行: 自分、アクセス: 全員）。発行された `/exec` のURLを `game/index.html` の `RANK_URL` に設定し、`#openRank` ボタンの `style="display:none"` を外すと有効になります。
