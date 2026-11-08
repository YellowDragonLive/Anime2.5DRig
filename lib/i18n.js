/*!
 * Anime2.5DRig — i18n layer
 * ------------------------------------------------------------------
 * A non-invasive translation layer: the original app keeps emitting
 * Japanese strings; this module translates DOM text (including text
 * generated later by app.js) on the fly and can switch language without
 * reloading the page, so the model being edited is preserved.
 *
 * Add a language: append an entry to LANGS and a dictionary to DICTS.
 * ------------------------------------------------------------------
 */
(function () {
  'use strict';

  var STORE_KEY = 'anime25d.lang';
  var LANGS = [
    { id: 'zh-CN', label: '简体中文', html: 'zh-CN', readme: 'README.zh-CN.md' },
    { id: 'ja',    label: '日本語',   html: 'ja',    readme: 'README.md' }
  ];
  var DEFAULT_LANG = 'zh-CN';

  /* ---------------------------------------------------------------- *
   * zh-CN dictionary. Keys are the exact Japanese strings emitted by
   * index.html and lib/*.js. Pure-kanji labels must be listed here,
   * because fragment replacement only runs on strings containing kana.
   * ---------------------------------------------------------------- */
  var ZH = {
    /* ---- page / header / drop zone ---- */
    'Anime2.5DRig — PSDドロップで動くアバター': 'Anime2.5DRig — 拖入 PSD 即可动起来的虚拟形象',
    'パーツ分けPSDをドロップするだけで、自動リギングされて動き出す2.5Dアバターツール': '只需拖入分层 PSD，即可自动绑定并动起来的 2.5D 虚拟形象工具',
    'サンプルA': '示例 A', 'サンプルB': '示例 B', 'サンプルAを読み込む': '加载示例 A', 'サンプルBを読み込む': '加载示例 B',
    'サンプルを読み込む': '加载示例', 'sample.psd を読み込む': '加载 sample.psd', 'sample2.psd を読み込む': '加载 sample2.psd',
    'モデル未読込': '未加载模型', 'モデルを調整': '调整模型',
    'PSDを開く': '打开 PSD', 'PSDを開く（Ctrl+O）': '打开 PSD（Ctrl+O）', 'PSDファイルを選ぶ': '选择 PSD 文件',
    '一時停止': '暂停', '一時停止（Space）': '暂停（空格）', '再生': '播放', '再生中': '播放中',
    '一時停止中 — 数値を調整して静止画を保存できます': '已暂停 — 可调整数值并保存静态图',
    'PNG保存': '保存 PNG', 'PNGを保存': '保存 PNG', '現在のポーズを透過PNGで保存': '将当前姿势保存为透明 PNG',
    '録画': '录制', '録画を開始': '开始录制', '録画を停止': '停止录制', '録画を停止して保存': '停止录制并保存',
    'モーションを動画で保存': '将动作保存为视频',
    '使い方': '使用说明', '使い方を閉じる': '关闭使用说明', 'READMEを読む': '阅读说明',
    'キーボードショートカット': '键盘快捷键', 'キーボードショートカット（?）': '键盘快捷键（?）',
    'ショートカット': '快捷键', 'ショートカットを閉じる': '关闭快捷键',
    '履歴': '历史记录', '元に戻す': '撤销', '元に戻す（Ctrl+Z）': '撤销（Ctrl+Z）',
    'やり直す': '重做', 'やり直す（Ctrl+Shift+Z）': '重做（Ctrl+Shift+Z）',
    '読み込みを中止': '取消加载', '読み込みを中止しました': '已取消加载',
    '設定を検索': '搜索设置', '目、髪、口、レイヤー…': '眼睛、头发、嘴巴、图层…',
    '一致する設定がありません': '没有匹配的设置', 'すべて畳む': '全部折叠', 'すべて開く': '全部展开',
    'アバターのプレビュー': '虚拟形象预览', 'カメラ映像のプレビュー': '摄像头画面预览', 'カメラ映像を隠す': '隐藏摄像头画面',
    '背景の市松模様は出力されません': '背景棋盘格不会被输出',
    'PREVIEW': '预览',
    'ホイールで拡大、ドラッグで移動。クリックで全体表示（F）': '滚轮缩放、拖动平移，点击恢复适应窗口（F）',
    '点をドラッグして基準位置を調整（矢印キーで1px・Shift+矢印で10px）。Esc または E で終了': '拖动圆点调整基准位置（方向键 1px，Shift+方向键 10px）。按 Esc 或 E 结束',
    'PSDを読み込むと編集を始められます': '加载 PSD 后即可开始编辑',
    'YOUR ART, IN MOTION': '让你的画动起来',
    'イラストに、動きを。': '让插画，动起来。',
    'パーツ分けしたPSDをドロップ。': '拖入已分好图层的 PSD。',
    '目・口・髪を読み取り、その場で動き出します。': '自动识别眼睛、嘴巴、头发，立刻动起来。',
    'RGB / 8bit PSD・128MBまで': 'RGB / 8bit PSD，最大 128MB',
    'レイヤー名は face / eyewhite / mouth_open や「顔・白目・前髪」など。フォルダにも対応。': '图层名可用 face / eyewhite / mouth_open，或「脸·眼白·刘海」等，也支持文件夹。',
    '全体': '适应窗口', 'アンカー編集': '编辑锚点', 'アンカー編集（E）': '编辑锚点（E）', 'アンカーを編集': '编辑锚点',
    '● REC': '● 录制中',
    /* ---- panel sections ---- */
    'WORKSPACE': '工作区',
    '自動': '自动', 'アイドル': '待机动作', '自動まばたき': '自动眨眼', 'ランダム動作': '随机动作',
    'ランダム口パク': '随机口型', 'カメラ追従': '摄像头追踪', 'マウス追従': '鼠标追踪',
    'マイク口パク': '麦克风口型', '髪の物理': '头发物理',
    '表情プリセット': '表情预设', '通常': '默认', '笑顔': '微笑', '薄目': '眯眼', '驚き': '惊讶',
    'ジト目': '死鱼眼', 'ウインク左': '左眨眼', 'ウインク右': '右眨眼',
    '同じボタンかキーをもう一度押すと解除。': '再次点击同一按钮或按同一按键即可取消。',
    'で解除。': '键清除预设。',
    '顔の向き': '头部朝向', '角度 X': '角度 X', '角度 Y': '角度 Y', '角度 Z': '角度 Z',
    '目': '眼睛', '左目の開き': '左眼开合', '右目の開き': '右眼开合', '視線 X': '视线 X', '視線 Y': '视线 Y',
    '瞳スケール': '瞳孔缩放', '閉じ目スケール左': '左闭眼缩放', '閉じ目スケール右': '右闭眼缩放',
    '閉じやすさ': '闭眼阈值', '差分 上下': '差分 上下', '差分 角度': '差分 角度',
    '眉': '眉毛', '眉（上下）': '眉毛（上下）', '眉角度 対称': '眉角度 对称', '眉角度 左': '眉角度 左', '眉角度 右': '眉角度 右',
    '口': '嘴巴', '開き': '张开', '形（笑い）': '形状（微笑）', '閉じ口 上下': '闭嘴 上下',
    '閉じ口 角度': '闭嘴 角度', '口スケール': '嘴巴缩放',
    '前髪': '刘海', '揺れ': '摆动幅度', '柔らかさ': '柔软度',
    'ブロック左': '左区块', 'ブロック中央': '中间区块', 'ブロック右': '右区块',
    '体・物理': '身体 · 物理', '体の傾き': '身体倾斜', '腕の高さ': '手臂高度', '腕位置補正': '手臂位置修正',
    '胸の揺れ': '胸部晃动', '胸位置 上下': '胸部位置 上下', '後髪の揺れ': '后发摆动',
    '後髪柔らかさ': '后发柔软度', '小物の揺れ': '饰品摆动',
    'アンカー（基準点）': '锚点（基准点）',
    '目・口・首などの自動検出位置がずれているときに、プレビュー上でドラッグして直せます。': '当眼睛、嘴巴、脖子等自动识别位置有偏差时，可在预览中拖动修正。',
    '自動検出の位置に戻す': '恢复自动识别位置',
    'カメラ・マイク': '摄像头 · 麦克风',
    'カメラ追従は顔のランドマークから、頭の向き・まばたき・視線・口・眉・笑顔を読み取ります。': '摄像头追踪通过面部特征点读取头部朝向、眨眼、视线、嘴、眉毛和笑容。',
    '正面を記録（キャリブレーション）': '记录正面（校准）', '記録を消す': '清除记录',
    'カメラ追従中に、正面を向いて自然な表情で押してください': '开启摄像头追踪后，请正面朝向镜头、保持自然表情再点击',
    '未記録（標準の顔の比率で判定します）': '未记录（按标准面部比例判定）',
    '記録済み（あなたの自然な表情を基準に判定します）': '已记录（以你的自然表情为基准判定）',
    '左右のまばたきを連動（オフでウインクを検出）': '左右眨眼联动（关闭后可识别单眼眨眼）',
    '眉を追跡': '追踪眉毛', '笑顔（口の形）を追跡': '追踪笑容（嘴形）', 'カメラ映像を小さく表示': '显示摄像头小窗',
    '頭の感度': '头部灵敏度', 'まばたき感度': '眨眼灵敏度', '口の感度': '嘴巴灵敏度',
    '眉の感度': '眉毛灵敏度', '視線の感度': '视线灵敏度', 'なめらかさ': '平滑度',
    'マイク感度': '麦克风灵敏度', 'ノイズゲート': '噪声门限', 'マイク入力（線はノイズゲート）': '麦克风输入（横线为噪声门限）',
    'OBS連携': 'OBS 联动', 'OBS連携の設定を開く': '打开 OBS 联动设置',
    'start_obs.bat（obs_server.py）で開くと、このブラウザで開いたPSD・調整・表情がOBSへ自動で反映されます。': '通过 start_obs.bat（obs_server.py）启动时，本浏览器中打开的 PSD、调整和表情会自动同步到 OBS。',
    'OBS表示へ同期する': '同步到 OBS 画面', 'コピー': '复制',
    'OBSの「ブラウザ」ソースに上のURLを設定します。幅・高さはPSDのサイズに合わせてください。': '把上面的 URL 填到 OBS 的「浏览器」源，宽高请与 PSD 尺寸一致。',
    'OBSのブラウザソースURL': 'OBS 浏览器源 URL',
    '書き出し': '导出', '背景': '背景', '透過': '透明', 'グリーンバック': '绿幕', 'ダーク': '深色',
    '録画の長さ': '录制时长', '3秒': '3 秒', '5秒': '5 秒', '10秒': '10 秒', '15秒': '15 秒', '30秒': '30 秒', '60秒': '60 秒',
    'フレームレート': '帧率', '形式': '格式',
    '動画は元のPSDサイズで書き出します。透過はWebM（Chrome / Edge）で保持されます。': '视频按 PSD 原始尺寸导出；透明背景仅在 WebM（Chrome / Edge）中保留。',
    '保存・設定': '保存 · 设置', '調整を保存': '保存调整', '調整を保存 ●': '保存调整 ●',
    'このブラウザに保存（Ctrl+S）': '保存到本浏览器（Ctrl+S）', '未保存の変更があります（Ctrl+S）': '有未保存的更改（Ctrl+S）',
    '保存状態に戻す': '恢复已保存状态', '設定JSONを書き出す': '导出设置 JSON', '設定JSONを読み込む': '导入设置 JSON',
    '数値リセット': '重置数值', '軽量PSDを保存': '保存轻量 PSD',
    '調整はこのブラウザにモデル別で保存。別の環境へはJSONで持ち出せます（JSONはプレビューにドロップしても読み込めます）。': '调整按模型保存在本浏览器中；可用 JSON 带到其他环境（JSON 也可直接拖进预览区加载）。',
    'レイヤー': '图层',
    '上が奥、下が手前。ドラッグか ↑↓ で並べ替え、▸ で濃さ・奥行きを調整します。': '上方为后层、下方为前层。可拖动或用 ↑↓ 排序，点 ▸ 调整浓度与景深。',
    'レイヤー設定を初期化': '重置图层设置', 'PSDの読み込み後に表示されます': '加载 PSD 后显示',
    'モデル情報・診断': '模型信息 · 诊断',
    'ダブルクリックで初期値に戻す': '双击恢复默认值',
    /* ---- status / errors emitted by app.js ---- */
    'このブラウザではWebGLを使用できません。ハードウェアアクセラレーションを有効にしてください。': '当前浏览器无法使用 WebGL，请开启硬件加速。',
    '描画の復旧を待ってから読み込んでください': '请等待渲染恢复后再加载',
    'すべて自動検出の位置です': '全部为自动识别位置',
    '中止': '取消',
    'PSD解析を開始できません（メモリ不足の可能性があります）。localhostで開き直すか、PSDを縮小してください': '无法开始解析 PSD（可能内存不足）。请改用 localhost 打开，或缩小 PSD',
    'lib/ag-psd.min.js が未読込です。ZIPを展開してから開く / lib フォルダを index.html と同じ階層に配置してください': '未能加载 lib/ag-psd.min.js。请先解压 ZIP，并确认 lib 文件夹与 index.html 同级',
    'lib/rigger.js が未読込です。lib フォルダの配置を確認してください': '未能加载 lib/rigger.js，请检查 lib 文件夹的位置',
    '拡張子が .psd のファイルを選んでください': '请选择扩展名为 .psd 的文件',
    'PSDは128MB以下にしてください': 'PSD 请勿超过 128MB',
    'PSDファイルが短すぎます': 'PSD 文件过短',
    '対応するPSDファイルではありません（PSBは未対応）': '不是受支持的 PSD 文件（不支持 PSB）',
    'PSDのサイズは一辺16384px・2400万画素以内にしてください': 'PSD 尺寸请控制在单边 16384px、2400 万像素以内',
    'PSDをRGB・8bit/チャンネルで保存し直してください': '请用 RGB / 8bit 每通道重新保存 PSD',
    '全パラメータを初期値に戻しました': '已将所有参数恢复默认值',
    '先にPSDを読み込んでください': '请先加载 PSD',
    '書き出し中…': '正在导出…',
    'このモデルの保存済み調整はありません': '该模型没有已保存的调整',
    '保存した調整を復元しました': '已恢复保存的调整',
    'このモデルの調整をブラウザに保存しました': '已将该模型的调整保存到浏览器',
    'ブラウザに保存できません。設定JSONを書き出してください': '无法保存到浏览器，请导出设置 JSON',
    '設定JSONを書き出しました': '已导出设置 JSON',
    '設定JSONは1MB以下にしてください': '设置 JSON 请勿超过 1MB',
    'モデルが切り替わりました。設定を選び直してください': '模型已切换，请重新选择设置文件',
    '設定を読み込みました': '已加载设置',
    '設定を読み込めません: ': '无法加载设置: ',
    '元に戻しました': '已撤销', 'やり直しました': '已重做',
    'レイヤー設定を初期化しました': '已重置图层设置',
    'このブラウザは動画書き出しに対応していません（Chrome / Edge / Firefox を使用してください）': '当前浏览器不支持视频导出（请使用 Chrome / Edge / Firefox）',
    '（この形式は透過を保持しません）': '（该格式不保留透明通道）',
    '録画を中止しました': '已取消录制',
    'PNGを書き出せませんでした': 'PNG 导出失败',
    '描画が一時停止しました。復旧を待っています': '渲染已暂停，正在等待恢复',
    '描画を復旧しました': '渲染已恢复',
    '描画の復旧に失敗しました。ページを再読み込みしてください': '渲染恢复失败，请刷新页面',
    'レイヤー構成を確認中…': '正在检查图层结构…',
    '画像を展開中…': '正在展开图像…',
    'ノイズを除去中…': '正在去噪…',
    'パーツ・アンカーを生成中…': '正在生成部件与锚点…',
    '（瞳の切り抜きを無効にしました）': '（已禁用瞳孔裁剪）',
    'アンカー編集中 — 静止したポーズで基準点を調整します': '正在编辑锚点 — 请在静止姿势下调整基准点',
    'アンカーを自動検出の位置に戻しました': '锚点已恢复自动识别位置',
    '（非対応）': '（不支持）',
    'カメラ準備中…': '摄像头准备中…', 'カメラ追従中': '摄像头追踪中',
    '通常ブラウザからの追跡を待っています': '等待编辑页面的追踪数据',
    '正面を向いて、自然な表情のまま1秒ほどお待ちください…': '请正面朝向镜头，保持自然表情约 1 秒…',
    '顔を検出できなかったため記録できませんでした': '未检测到人脸，记录失败',
    'キャリブレーションを消去しました': '已清除校准记录',
    'マイク準備中…': '麦克风准备中…', 'マイク使用中': '麦克风使用中',
    '（start_obs.bat で起動すると表示されます）': '（通过 start_obs.bat 启动后显示）',
    'OBS用モデル': 'OBS 模型',
    'OBS用のURLをコピーしました': '已复制 OBS URL',
    'URLを選択しました。Ctrl+C でコピーしてください': '已选中 URL，请按 Ctrl+C 复制',
    'OBS中継サーバーに接続していません。start_obs.bat（python obs_server.py）で開くと、このブラウザで開いたPSD・調整・表情がOBSへ自動で反映されます。': '未连接到 OBS 中继服务。用 start_obs.bat（python obs_server.py）启动后，浏览器中打开的 PSD、调整和表情会自动同步到 OBS。',
    '古い obs_server.py です。表情・モデルの同期には最新版に置き換えてください（顔追跡のみ中継します）。': 'obs_server.py 版本过旧，请替换为最新版以同步表情与模型（当前仅中继面部追踪）。',
    'OBS 同期OFF': 'OBS 同步已关闭', 'OBS 送信中…': 'OBS 发送中…', 'OBS 待機中': 'OBS 待机中',
    '同期はOFFです。OBSには最後に送った状態が表示されます。': '同步已关闭，OBS 将保持最后一次发送的状态。',
    '中継サーバーに接続中 · OBS表示 ': '已连接中继服务 · OBS 画面 ',
    'このモデルを送信済み': '此模型已发送', 'モデル送信待ち': '等待发送模型', 'モデル未読込': '未加载模型',
    'README.md を取得できませんでした。': '无法获取 README.md。', 'GitHubで読む': '在 GitHub 上查看',
    '設定ファイル': '设置文件',
    /* ---- settings validation (runtime.js) ---- */
    'アンカー設定が不正です': '锚点设置无效', '対応する設定ファイルではありません': '不是受支持的设置文件',
    '別のPSD用の設定です。保存時と同じPSDを読み込んでください': '这是其他 PSD 的设置，请加载保存时的同一个 PSD',
    '設定の構造が不正です': '设置结构无效', '自動動作の設定が不正です': '自动动作设置无效',
    'レイヤー設定が不正です': '图层设置无效',
    /* ---- rigger.js errors + role labels ---- */
    'PSDのキャンバスサイズが不正です': 'PSD 画布尺寸无效',
    'キャンバスが大きすぎます（最大2400万画素・一辺16384px）': '画布过大（最大 2400 万像素，单边 16384px）',
    'フォルダの階層が深すぎます': '文件夹层级过深',
    'レイヤー数が多すぎます（最大1000）': '图层数过多（最多 1000）',
    '画像レイヤーのサイズが不正または過大です': '图像图层尺寸无效或过大',
    '画像レイヤーの画素データが不正です': '图像图层的像素数据无效',
    'レイヤー画像の合計が大きすぎます（最大9600万画素）': '图层图像总量过大（最大 9600 万像素）',
    '表示可能な画像レイヤーが見つかりません': '未找到可显示的图像图层',
    'リグ解析に必要なメモリが大きすぎます。レイヤー数または解像度を減らしてください': '绑定解析所需内存过大，请减少图层数或降低分辨率',
    'face レイヤーがありません — キャンバス中央を顔とみなします': '没有 face 图层 — 已把画布中心当作脸部',
    'レイヤー 1': '图层 1', '閉じ目2': '闭眼 2',
    '翼': '翅膀', '尻尾': '尾巴', '後髪': '后发', '靴': '鞋子', '脚': '腿',
    '下半身の服': '下装', '首': '脖子', '上半身の服': '上装', '首元': '颈部饰品',
    '腕・手': '手臂 · 手', '小物': '饰品', '耳飾り': '耳饰', '耳': '耳朵',
    '顔': '脸', '顔の細部': '脸部细节', '頭の飾り': '头部饰品',
    '閉じ口': '闭嘴', '開き口': '张嘴', '鼻': '鼻子', '白目': '眼白',
    '瞳': '瞳孔', 'まつ毛': '睫毛', '閉じ目': '闭眼', '長い閉じ目': '长闭眼',
    '眼鏡': '眼镜', '横髪': '侧发', 'アホ毛': '呆毛',
    /* ---- diagnostics ---- */
    '顔（face）': '脸（face）', '見つからないため顔の位置を推定しています': '未找到，已自动推测脸部位置',
    '白目（eyewhite）': '眼白（eyewhite）', '瞳（irides）': '瞳孔（irides）', 'まつ毛（eyelash）': '睫毛（eyelash）',
    '片側だけ見つかりました': '只找到一侧', '見つかりません': '未找到',
    '閉じ目（eye_close）': '闭眼（eye_close）',
    '汎用差分を自動配置（「目」の差分バーで調整可）': '已自动放置通用差分（可用「眼睛」的差分滑杆调整）',
    'まぶたの圧縮だけでまばたきします': '仅通过眼皮压缩实现眨眼',
    '長い閉じ目（eye_close2）': '长闭眼（eye_close2）', '眉（eyebrow）': '眉毛（eyebrow）',
    '開き口（mouth_open）': '张嘴（mouth_open）', '口パクできません': '无法实现口型',
    '閉じ口（mouth_close）': '闭嘴（mouth_close）',
    '汎用差分を自動配置（「口」のバーで調整可）': '已自动放置通用差分（可用「嘴巴」滑杆调整）',
    'front hair / back hair（前髪・後ろ髪）が見つかりません': '未找到 front hair / back hair（刘海 / 后发）',
    '（名前を規約に合わせると動きが付きます）': '（按命名规范命名后即可获得动作）',
    /* ---- anchors overlay labels ---- */
    '顔の中心': '脸部中心', '左目': '左眼', '右目': '右眼', '首の回転軸': '颈部旋转轴', '胸': '胸部',
    '（ドラッグまたは矢印キーで移動）': '（拖动或用方向键移动）',
    /* ---- devices / recorder / renderer / obs-sync ---- */
    '顔追跡モデルの読み込みがタイムアウトしました': '面部追踪模型加载超时',
    '顔追跡モデルを取得できません': '无法获取面部追踪模型',
    'ブラウザのカメラ許可を確認してください': '请检查浏览器的摄像头权限',
    '他のアプリがカメラを使用中です': '摄像头正被其他应用占用',
    'カメラが見つかりません': '未找到摄像头',
    'https または localhost で開いてください': '请通过 https 或 localhost 打开',
    '顔を検出できません': '未检测到人脸',
    '顔追跡が停止しました。カメラを再度ONにしてください': '面部追踪已停止，请重新开启摄像头',
    'カメラが切断されました': '摄像头已断开',
    'マイクが切断されました': '麦克风已断开',
    'ブラウザのマイク許可を確認してください': '请检查浏览器的麦克风权限',
    'WebM（VP9・透過対応）': 'WebM（VP9 · 支持透明）', 'WebM（VP8・透過対応）': 'WebM（VP8 · 支持透明）',
    'MP4（H.264・透過なし）': 'MP4（H.264 · 不透明）', 'MP4（透過なし）': 'MP4（不透明）',
    '録画中です': '正在录制', 'このブラウザは動画書き出しに対応していません': '当前浏览器不支持视频导出',
    'このブラウザで使える動画形式がありません': '当前浏览器没有可用的视频格式',
    '録画に失敗しました': '录制失败', '動画データが空です': '视频数据为空',
    '瞳のマスク用メモリを確保できません。PSDを縮小してください': '无法为瞳孔遮罩分配内存，请缩小 PSD',
    '描画メモリを確保できません。PSDを縮小してください': '无法分配渲染内存，请缩小 PSD',
    'OBS用のモデルがまだ送られていません': '尚未发送 OBS 用模型',
    /* ---- shortcut table ---- */
    '一時停止 / 再生': '暂停 / 播放', '表情プリセット（同じキーで解除）': '表情预设（再按同一键取消）',
    '表情プリセットを解除': '清除表情预设', 'やり直す（Ctrl+Y も可）': '重做（也可用 Ctrl+Y）',
    '調整をブラウザに保存': '保存调整到浏览器', 'アンカー編集モード': '锚点编辑模式',
    'プレビューを全体表示に戻す': '预览恢复适应窗口', '背景を切り替え': '切换背景',
    'プレビューの拡大・縮小': '缩放预览', '拡大中のプレビューを移動': '移动放大后的预览',
    'この一覧を表示': '显示本列表', 'ダイアログ・アンカー編集を閉じる': '关闭对话框 / 退出锚点编辑',
    'ホイール': '滚轮', 'ドラッグ': '拖动', 'ダブルクリック': '双击',
    /* ---- 歌词演唱（song-sync.js / lipsync.js） ---- */
    '歌詞口パク（歌う）': '歌词口型（演唱）',
    'LRC 歌詞と音源を読み込むと、歌詞の拍に合わせて口が動きます。日本語の漢字は内蔵辞書で読みに変換します。':
      '载入 LRC 歌词与音频后，角色会按歌词的拍子动嘴；日文汉字由内置词典转成假名读音。',
    '歌詞LRCを読み込む': '载入歌词 LRC', '音源を読み込む': '载入歌曲音频',
    '再生位置': '播放位置', '口の開き倍率': '张口强度', 'タイミング補正': '时间偏移（正值为提前）',
    '歌詞口パクを有効にする': '启用歌词口型', '歌詞未読込': '尚未载入歌词',

    /* ---- v2.2 自动生成口（mouthgen.js） ---- */
    '自動生成口': '自动生成嘴',
    '自動生成口：PSDに閉じ口が無いとき（see-through など）、元の口から あ・い・う・え・お の口形を自動で描きます。0 で従来の差分切り替え。':
      '自动生成嘴：PSD 里没有闭嘴图层时（例如 see-through 拆出的图），会根据原画的嘴自动绘制 a・i・u・e・o 的口型；设为 0 则退回原来的差分切换。',
    '口のスタイル': '口型风格',
    '口のスタイル番号': '口型风格编号',
    '口のスタイル: ': '口型风格: ',
    '合わない時は別のスタイルに切り替えてください': '不贴合时请换一种风格',
    '母音 あ': '元音 a', '母音 い': '元音 i', '母音 う': '元音 u', '母音 え': '元音 e', '母音 お': '元音 o',
    '下あごの動き': '下巴联动',
    'おまかせ（自動判定）': '自动判定',
    '計測（元の口の形から描く）': '实测（按原画嘴形绘制）',
    '元の口は開いた絵': '原画是张开的嘴',
    '元の口は閉じた絵（閉じ口に使用）': '原画是闭着的嘴（用作闭嘴）',
    ' · おまかせ=': ' · 风格=',
    ' · 「口」でスタイル変更可': ' · 可在「嘴巴」里换风格',
    '音声ファイルで口パク（歌）': '用音频文件对口型（唱歌）',
    '歌のボーカル（人声分離したもの推奨）を再生しながら、母音を推定して口を動かします':
      '播放歌曲人声（建议用人声分离轨），自动估计元音并驱动嘴形',
    '声の高さ補正': '音高补偿',
    '音声で口パク中': '音频口型中',
    '音声ファイルの再生が終わりました': '音频已播放完毕',
    ' を再生して口パクします（マイク口パクを押すと停止）': ' 播放中，按「麦克风口型」可停止',
    '音声を再生できません: ': '无法播放音频: ',
    /* ---- 口型风格（mouthstyles.js 的 label / note） ---- */
    'アニメ標準': '动画标准',
    '細い上唇線 + 口内・舌・上の歯。迷ったらこれ': '细上唇线 + 口腔・舌・上齿。拿不定就用这个',
    '唇あり（リアル寄り）': '有唇（偏写实）',
    '色の付いた上下の唇。see-through の厚塗り・リアル系の顔に': '上下唇带颜色，适合 see-through 厚涂、写实脸',
    'シンプル（ベタ塗り）': '简洁（平涂）',
    '口内は一色、歯・舌なし。崩れにくく、どの絵柄にも馴染む': '口腔单一色，无牙无舌；不易崩，适配各种画风',
    'デフォルメ（ちびキャラ）': 'Q 版（小豆丁）',
    '丸い口と太めの輪郭線、大きめの舌。ちび・SD絵向け': '圆嘴 + 粗轮廓线 + 大舌头，适合 Q 版・SD 画风',
    /* ---- rigger.js 的警告：内部保持日文用于匹配，只在显示层翻译 ---- */
    '空のレイヤー "': '空图层 "',
    '" をスキップしました': '" 已跳过',
    'キャンバス内に表示可能な画素がありません': '画布内没有可显示的像素',
    '未知のレイヤー名 "': '未知图层名 "',
    ' — 頭に追従させます': ' — 跟随头部',
    ' — 体に追従させます': ' — 跟随身体',
    '" の左右分離に失敗（空レイヤー？）': '" 左右分离失败（空图层？）',
    '目のアンカーが不完全です（eyewhite/irides を確認）': '眼部锚点不完整（请检查 eyewhite / irides）',
    'mouth_open / mouth_close がありません': '没有 mouth_open / mouth_close',
    '不足する閉じ目を自動配置しました（「目」の差分バーで調整可）': '已自动补齐缺失的闭眼（可用「眼睛」的差分滑杆调整）',
    'mouth_close が無いため汎用閉じ口を自動配置しました（「口」のバーで調整可）':
      '没有 mouth_close，已自动放置通用闭嘴（可用「嘴巴」滑杆调整）'
  };

  /* Fragment dictionary: handles strings assembled at runtime, e.g.
     `displayName + ' を読み込みました'`. Longest fragment wins. */
  var PARTS = [
    ['この端末の描画サイズ（', '超出本设备的渲染尺寸上限（'],
    ['）を超えています。PSDを縮小してください', '）。请缩小 PSD'],
    [' px を超えています', 'px'], ['px を超えています', 'px'],
    ['画像パーツがこの端末の上限 ', '图像部件超出本设备上限 '],
    ['描画の初期化に失敗しました: ', '渲染初始化失败: '],
    ['を読み込み中…', ' 正在加载…'],
    [' を読み込みました', ' 已加载'],
    [' が見つかりません（HTTP ', ' 未找到（HTTP '],
    ['が読み込めていません（ZIP展開・libフォルダの配置を確認）', '未能加载（请检查 ZIP 是否已解压、lib 文件夹是否就位）'],
    ['か所を手動で調整中', ' 处已手动调整'],
    ['\nノイズ除去: ', '\n去噪: '], ['ノイズ除去: ', '去噪: '], ['レイヤー', '图层'],
    ['エラー: ', '错误: '],
    ['の数値', ' 的数值'],
    ['軽量PSDを保存しました（', '已保存轻量 PSD（'],
    ['MB / ノイズ除去+トリム済み）', 'MB / 已去噪并裁剪）'],
    ['書き出しエラー: ', '导出错误: '],
    ['（レイヤー構成の違い ', '（图层构成差异 '],
    [' 件は初期値のまま）', ' 处保持默认值）'],
    ['調整を復元できません: ', '无法恢复调整: '],
    ['。「調整を保存」で記憶できます', '，点击「保存调整」可记住'],
    ['動画を書き出しました（', '已导出视频（'],
    ['px・', 'px · '], ['秒・', '秒 · '],
    ['録画できません: ', '无法录制: '],
    ['設定を読み込めません: ', '无法加载设置: '],
    ['の詳細', ' 的详情'], ['を表示', ' 显示'], ['を奥へ', ' 移到后层'], ['を手前へ', ' 移到前层'],
    ['ドラッグで並べ替え', '拖动排序'],
    ['濃さ', '浓度'], ['奥行き', '景深'],
    ['頭に追従', '跟随头部'], ['体に追従', '跟随身体'],
    ['未分類 → ', '未分类 → '], ['に追従', ' 跟随'],
    ['未分類のレイヤー ', '未分类图层 '],
    ['パーツ / 揺れもの', ' 个部件 / 摆动部件 '], ['本を自動リグ', ' 组已自动绑定'],
    [' 閉じ位置', ' 闭眼位置'],
    ['カメラを開始できません: ', '无法启动摄像头: '],
    ['マイクを開始できません: ', '无法启动麦克风: '],
    ['正面の表情を記録しました（', '已记录正面表情（'], ['フレーム）', ' 帧）'],
    ['OBS ● 表示中 ', 'OBS ● 显示中 '], ['OBS表示 ', 'OBS 画面 '], ['件 · ', ' 个 · '],
    ['PNGを書き出しました（', '已导出 PNG（'], ['・透過', ' · 透明'],
    ['アンカー設定が不正です: ', '锚点设置无效: '],
    ['数値設定が不正です: ', '数值设置无效: '],
    ['OBSへモデルを送れません: ', '无法向 OBS 发送模型: '],
    ['揺れ', '摆动'], ['自動生成', '自动生成'],
  ].sort(function (a, b) { return b[0].length - a[0].length; });

  var DICTS = { 'zh-CN': ZH };
  var ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  var SKIP_TEXT = 'script,style,code,pre,.layer-name,#obsUrl,#fps,[data-i18n-ignore]';
  var SKIP_ATTR = '#modelName,.layer-name,[data-i18n-ignore]';
  var KANA = /[\u3040-\u30ff\u31f0-\u31ff]/;

  /* Exact dictionary entries also work as fragments, so composed strings
     like `label.textContent + 'の数値'` are translated completely. */
  var ALL_PARTS = (function () {
    var extra = [];
    for (var k in ZH) {
      if (Object.prototype.hasOwnProperty.call(ZH, k) && k.length >= 2) extra.push([k, ZH[k]]);
    }
    return PARTS.concat(extra).sort(function (a, b) { return b[0].length - a[0].length; });
  })();

  /* All fragments, longest first, compiled into ONE regex. A single
     replace pass means text produced by an earlier fragment is never
     re-scanned — that used to turn the translated "部件" into "部 个". */
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var FRAG_MAP = Object.create(null);
  var FRAG_RE = (function () {
    var keys = [];
    for (var i = 0; i < ALL_PARTS.length; i++) {
      var k = ALL_PARTS[i][0];
      if (!(k in FRAG_MAP)) { FRAG_MAP[k] = ALL_PARTS[i][1]; keys.push(k); }
    }
    return new RegExp(keys.map(escRe).join('|'), 'g');
  })();

  /* ---- language state ---- */
  function readStore(k, fallback) { try { return localStorage.getItem(k) || fallback; } catch (e) { return fallback; } }
  function writeStore(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* file:// or private mode */ } }
  function meta(id) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i].id === id) return LANGS[i]; return LANGS[0]; }

  var urlLang = null;
  try { urlLang = new URLSearchParams(location.search).get('lang'); } catch (e) { /* no URLSearchParams */ }
  var valid = function (id) { return LANGS.some(function (l) { return l.id === id; }); };
  var current = valid(urlLang) ? urlLang : readStore(STORE_KEY, DEFAULT_LANG);
  if (!valid(current)) current = DEFAULT_LANG;
  var originalTitle = document.title;

  function has(dict, k) { return Object.prototype.hasOwnProperty.call(dict, k); }
  /* Exact lookup also tolerates the leading/trailing whitespace that
     HTML text nodes around <kbd>/<input> elements often carry. */
  function exact(dict, s) {
    if (has(dict, s)) return dict[s];
    var t = s.trim();
    if (t && t !== s && has(dict, t)) return s.replace(t, dict[t]);
    return null;
  }

  function tr(s) {
    if (current === 'ja' || typeof s !== 'string' || !s) return s;
    var dict = DICTS[current];
    if (!dict) return s;
    var hit = exact(dict, s);
    if (hit !== null) return hit;
    /* Chinese content never reaches tr(): already translated nodes are
       skipped via __i18nOut, the Chinese README dialog is marked
       data-i18n-ignore, and layer/file names are excluded. */
    var out = s.replace(FRAG_RE, function (m) { return FRAG_MAP[m]; });
    /* Counters that keep their unit after the number, e.g. `3房` / `3件`.
       The mouth/strand label puts the number after 房 (`前髪 3房`), so both
       orders are handled. */
    return out.replace(/(\d+)件/g, '$1 个').replace(/房(\d+)/g, '$1 束').replace(/(\d+)房/g, '$1 束');
  }

  /* #modelName shows the user's own file name — only translate known
     placeholder strings, never a real PSD file name. */
  function exactOnly(s) {
    if (current === 'ja') return s;
    var dict = DICTS[current];
    if (!dict) return s;
    var hit = exact(dict, s);
    return hit === null ? s : hit;
  }

  /* ---- DOM translation ------------------------------------------------
     Each translated text node remembers its original Japanese value and
     the value we wrote, so external updates (status messages, button
     labels set by app.js) are detected and re-translated, while our own
     writes are ignored. Language switching re-applies from the originals
     without reloading the page.
  ---------------------------------------------------------------------- */
  function applyText(node, force) {
    if (node.nodeType !== 3) return;
    if (!force && node.__i18nOut !== undefined && node.nodeValue === node.__i18nOut) return;
    var orig = force ? (node.__i18nOrig !== undefined ? node.__i18nOrig : node.nodeValue) : node.nodeValue;
    node.__i18nOrig = orig;
    var isName = node.parentElement && node.parentElement.id === 'modelName';
    var out = current === 'ja' ? orig : (isName ? exactOnly(orig) : tr(orig));
    node.__i18nOut = out;
    if (node.nodeValue !== out) node.nodeValue = out;
  }

  function applyAttrs(el, force) {
    if (el.nodeType !== 1 || el.closest(SKIP_ATTR)) return;
    if (!el.__i18nAttrOrig) el.__i18nAttrOrig = {};
    if (!el.__i18nAttrOut) el.__i18nAttrOut = {};
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var now = el.getAttribute(a);
      if (now === null) continue;
      if (!force && el.__i18nAttrOut[a] === now) continue; /* our own write */
      var orig = force && (a in el.__i18nAttrOrig) ? el.__i18nAttrOrig[a] : now;
      el.__i18nAttrOrig[a] = orig;
      var out = current === 'ja' ? orig : tr(orig);
      el.__i18nAttrOut[a] = out;
      if (now !== out) el.setAttribute(a, out);
    }
  }

  function walk(root) {
    if (root.nodeType === 3) {
      if (root.parentElement && root.parentElement.closest(SKIP_TEXT)) return;
      applyText(root); return;
    }
    if (root.nodeType !== 1 || root.closest(SKIP_TEXT)) return;
    applyAttrs(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [], n;
    while ((n = tw.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].parentElement && nodes[i].parentElement.closest(SKIP_TEXT)) continue;
      applyText(nodes[i]);
    }
    var kids = root.querySelectorAll('*');
    for (var j = 0; j < kids.length; j++) applyAttrs(kids[j]);
  }

  function reapply() {
    var tw = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    var nodes = [], n;
    while ((n = tw.nextNode())) {
      if (n.parentElement && n.parentElement.closest(SKIP_TEXT)) continue;
      nodes.push(n);
    }
    for (var i = 0; i < nodes.length; i++) applyText(nodes[i], true);
    var els = document.querySelectorAll('*');
    for (var j = 0; j < els.length; j++) applyAttrs(els[j], true);
    document.title = current === 'ja' ? originalTitle : tr(originalTitle);
  }

  var observer = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'childList') {
        for (var k = 0; k < m.addedNodes.length; k++) walk(m.addedNodes[k]);
      } else if (m.type === 'characterData') {
        var p = m.target.parentElement;
        if (p && p.closest(SKIP_TEXT)) continue;
        applyText(m.target);
      } else if (m.type === 'attributes') {
        applyAttrs(m.target);
      }
    }
  });

  /* ---- language picker in the header ---- */
  function buildPicker() {
    var host = document.querySelector('.header-actions') || document.querySelector('header');
    if (!host) return null;
    var label = document.createElement('label');
    label.className = 'lang-pick';
    label.setAttribute('data-i18n-ignore', '');
    var span = document.createElement('span');
    span.textContent = '语言';
    var sel = document.createElement('select');
    sel.id = 'langSelect';
    sel.setAttribute('aria-label', '界面语言 / Interface language');
    for (var i = 0; i < LANGS.length; i++) {
      var o = document.createElement('option');
      o.value = LANGS[i].id; o.textContent = LANGS[i].label;
      sel.appendChild(o);
    }
    sel.value = current;
    sel.addEventListener('change', function () { setLang(sel.value); });
    label.appendChild(span); label.appendChild(sel);
    host.appendChild(label);
    return sel;
  }

  var picker = null;
  function setLang(id) {
    if (!valid(id) || id === current) return;
    current = id;
    writeStore(STORE_KEY, id);
    document.documentElement.lang = meta(id).html;
    if (picker) picker.value = id;
    reapply();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: id } }));
  }

  /* ---- boot ---- */
  function boot() {
    document.documentElement.lang = meta(current).html;
    /* The guide is a localized Markdown file; do not run it through the
       Japanese->Chinese dictionary (that would mangle Chinese text). */
    var readmeBody = document.getElementById('readmeBody');
    if (readmeBody) readmeBody.setAttribute('data-i18n-ignore', '');
    walk(document.documentElement);
    document.title = current === 'ja' ? originalTitle : tr(originalTitle);
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
    picker = buildPicker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Public API for app.js (README dialog). */
  window.I18N = {
    get lang() { return current; },
    t: tr,
    readmeFile: function () { return meta(current).readme; },
    languages: LANGS,
    setLang: setLang
  };
})();
