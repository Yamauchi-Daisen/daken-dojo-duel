/**
 * Daken Dojo Duel 記録受付（Google Apps Script）
 * - doPost: ゲームから送られた稽古の記録を「稽古ログ」に追記し、「プレイヤー」を更新する
 * - doGet ?action=top : 四天王（各部門の上位4名）を返す。名前と記録だけで、ほかの情報は返さない
 * スプレッドシート自体は管理者（所有者）だけが開ける。全員の記録と稽古の頻度はここで確認する。
 */
const LOG = '稽古ログ', PL = 'プレイヤー';
const DAN = ['入門','五級','四級','三級','二級','一級','初段','二段','三段','四段','五段','師範','免許皆伝'];
const KW = ['初級','中級','上級'];
const EN = ['門番','兄弟子','師範代','道場主'];
const DIFF = {easy:'やさしい', normal:'ふつう', hard:'きびしい'};
const TZ = 'Asia/Tokyo';
const PL_HEAD = ['ID','名前','段位','段位の基準(打/分)','格闘の自己ベスト(打/分)','連撃の最長(秒)',
  '瓦割り初級(枚)','瓦割り中級(枚)','瓦割り上級(枚)',
  '格闘最短:門番(秒)','格闘最短:兄弟子(秒)','格闘最短:師範代(秒)','格闘最短:道場主(秒)',
  '稽古の回数','稽古した日数','直近7日の回数','総打鍵数','初回の稽古','最後の稽古','使用キャラ'];
const LOG_HEAD = ['日時','名前','ID','稽古','内容','結果','記録','正確率','打鍵数'];

function setup() {
  sheet_(PL, PL_HEAD).getRange(1, 1, 1, PL_HEAD.length).setValues([PL_HEAD]);
  sheet_(LOG, LOG_HEAD);
}

function sheet_(name, head) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  }
  return sh;
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

const num_ = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
const str_ = (v, n) => String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').slice(0, n);
const safe_ = s => /^[=+\-@]/.test(s) ? "'" + s : s; // 数式として解釈されないように

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action !== 'record') return out_({ok: false});
    const pid = str_(b.pid, 64), name = safe_(str_(b.name, 20).trim());
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(pid) || !name) return out_({ok: false});
    const now = new Date();
    if (b.entry) logEntry_(pid, name, b.entry, now);
    upsertPlayer_(pid, name, b.summary || {}, now);
    return out_({ok: true});
  } catch (err) {
    return out_({ok: false});
  } finally {
    lock.releaseLock();
  }
}

function logEntry_(pid, name, en, now) {
  const acc = num_(en.acc), keys = num_(en.keys);
  let row;
  if (en.m === 'k') row = ['瓦割り', KW[en.lv] || '', num_(en.tiles) + ' 枚', '平均 ' + num_(en.avg).toFixed(2) + ' 秒'];
  else if (en.m === 'f') row = ['格闘', (EN[en.idx] || '') + '（' + (DIFF[en.diff] || '') + '）', en.win ? '勝ち' : '負け', num_(en.kpm) + ' 打/分'];
  else if (en.m === 'o') row = ['連撃', '段階 ' + num_(en.lv) + ' まで', num_(en.sec).toFixed(1) + ' 秒', num_(en.hits) + ' 枚'];
  else return;
  const sh = sheet_(LOG, LOG_HEAD);
  sh.appendRow([now, name, pid].concat(row, [acc, keys]));
  const r = sh.getLastRow();
  sh.getRange(r, 1).setNumberFormat('yyyy/mm/dd hh:mm');
  sh.getRange(r, 8).setNumberFormat('0%');
}

function upsertPlayer_(pid, name, s, now) {
  // 稽古の頻度は、端末側の記録ではなく稽古ログから数える（端末で記録を消しても残る）
  const log = sheet_(LOG, LOG_HEAD).getDataRange().getValues().slice(1).filter(r => r[2] === pid);
  const day = d => Utilities.formatDate(new Date(d), TZ, 'yyyy-MM-dd');
  const days = new Set(log.map(r => day(r[0]))).size;
  const weekAgo = now.getTime() - 7 * 86400000;
  const recent = log.filter(r => new Date(r[0]).getTime() >= weekAgo).length;
  const keys = log.reduce((a, r) => a + num_(r[8]), 0);
  const first = log.length ? log[0][0] : now, last = log.length ? log[log.length - 1][0] : now;
  const f = s.fight || {}, k = s.kawara || {};
  const ft = i => (f[i] && typeof f[i].time === 'number') ? f[i].time : '';
  const values = [pid, name,
    (typeof s.dan === 'number' && s.dan >= 0 && DAN[s.dan]) ? DAN[s.dan] : '判定前',
    num_(s.danKpm), num_(s.pbKpm), num_(s.ochi),
    num_(k[0]), num_(k[1]), num_(k[2]),
    ft(0), ft(1), ft(2), ft(3),
    log.length, days, recent, keys, first, last,
    /^[A-Za-z0-9_]{1,24}$/.test(String(s.skin || '')) ? String(s.skin) : ''];
  const sh = sheet_(PL, PL_HEAD);
  const ids = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues().map(r => r[0]);
  let row = ids.indexOf(pid) + 1;
  if (row < 2) { sh.appendRow(values); row = sh.getLastRow(); }
  else sh.getRange(row, 1, 1, values.length).setValues([values]);
  sh.getRange(row, 18, 1, 2).setNumberFormat('yyyy/mm/dd hh:mm');
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action !== 'top') return out_({ok: true, service: 'Daken Dojo Duel'});
  const me = String(p.pid || '');
  const rows = sheet_(PL, PL_HEAD).getDataRange().getValues().slice(1)
    .filter(r => r[0] && r[1])
    .map(r => ({pid: r[0], name: String(r[1]).replace(/^'/, ''), dan: DAN.indexOf(r[2]), danKpm: num_(r[3]), pbKpm: num_(r[4]), ochi: num_(r[5]),
      skin: String(r[19] || ''), kw: [num_(r[6]), num_(r[7]), num_(r[8])], fight: [r[9], r[10], r[11], r[12]].map(x => x === '' ? null : Number(x))}));
  const top = (list, val, sub) => list.slice(0, 4).map(r => ({name: r.name, v: val(r), sub: sub ? sub(r) : null, skin: r.skin || '', me: r.pid === me}));
  return out_({
    ok: true,
    dan: top(rows.filter(r => r.dan >= 0).sort((a, b) => b.dan - a.dan || b.danKpm - a.danKpm), r => r.dan, r => r.danKpm),
    kpm: top(rows.filter(r => r.pbKpm > 0).sort((a, b) => b.pbKpm - a.pbKpm), r => r.pbKpm),
    ochi: top(rows.filter(r => r.ochi > 0).sort((a, b) => b.ochi - a.ochi), r => r.ochi),
    kawara: [0, 1, 2].map(i => top(rows.filter(r => r.kw[i] > 0).sort((a, b) => b.kw[i] - a.kw[i]), r => r.kw[i])),
    fight: [0, 1, 2, 3].map(i => top(rows.filter(r => r.fight[i] != null && !isNaN(r.fight[i])).sort((a, b) => a.fight[i] - b.fight[i]), r => r.fight[i]))
  });
}
