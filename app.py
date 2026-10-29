"""Daken Dojo Duel（DDD）を Streamlit で配信するための入口。

ゲーム本体は game/index.html（1ファイルで完結した HTML）にあり、
ここではそれを画面いっぱいの枠に表示するだけ。
稽古の記録と四天王は、ゲームから Google スプレッドシート（gas/Code.gs）へ直接送られる。
"""
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="Daken Dojo Duel",
    page_icon=":material/keyboard:",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Streamlit の余白やヘッダーを消し、ゲームの枠を画面の高さいっぱいに広げる
st.markdown(
    """
    <style>
      header[data-testid="stHeader"], footer, #MainMenu {display: none !important;}
      .block-container, [data-testid="stMainBlockContainer"] {padding: 0 !important; max-width: 100% !important;}
      [data-testid="stVerticalBlock"] {gap: 0 !important;}
      iframe {display: block; width: 100% !important; height: 100vh !important; border: 0;}
      .stApp {background: #141a28;}
    </style>
    """,
    unsafe_allow_html=True,
)

GAME = Path(__file__).parent / "game" / "index.html"


@st.cache_data
def load_game(mtime: float) -> str:
    # mtime を引数にして、index.html を差し替えたら読み直す
    return GAME.read_text(encoding="utf-8")


components.html(load_game(GAME.stat().st_mtime), height=900, scrolling=True)
