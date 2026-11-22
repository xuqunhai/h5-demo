// 打印图片：把照片按毫米精确排版到一张纸（默认 A4），再导出「相册图片」或「PDF」去打印。
// 几何一律以 mm 为准，屏幕只做等比缩放显示；导出时再按 DPI 重画一遍，保证物理尺寸。
const DPI = 300
const MM_PER_INCH = 25.4
const MIN_MM = 5
const MAX_ITEMS = 12
const PRESETS = [
  { name: 'A4', w: 210, h: 297 },
  { name: 'A5', w: 148, h: 210 },
  { name: '6寸', w: 102, h: 152 },
  { name: '7寸', w: 127, h: 178 }
]

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const one = (v) => Math.round(v * 10) / 10
const px2 = (v) => Math.round(v * 100) / 100

Page({
  data: {
    pageW: 210,
    pageH: 297,
    wInput: '210',
    hInput: '297',
    presets: PRESETS,
    pxPerMm: 0,
    frameW: 0,
    frameH: 0,
    items: [],
    selId: '',
    sel: null,
    lockAspect: true,
    busy: false
  },

  onReady() {
    this.measureStage()
  },

  /* ---------- 版面 ---------- */

  measureStage() {
    wx.createSelectorQuery()
      .select('.stage')
      .boundingClientRect((rect) => {
        if (!rect) return
        this.container = { w: rect.width, h: rect.height }
        this.relayout()
      })
      .exec()
  },

  // 按容器大小算出 1mm 对应多少屏幕像素，并刷新所有图片的像素坐标
  relayout() {
    const box = this.container
    if (!box) return
    const { pageW, pageH } = this.data
    const s = Math.min(box.w / pageW, box.h / pageH)
    const items = this.data.items.map((it) => this.withPx(it, s))
    const patch = {
      pxPerMm: s,
      frameW: px2(pageW * s),
      frameH: px2(pageH * s),
      items
    }
    if (this.data.selId) patch.sel = this.selView(items)
    this.setData(patch)
  },

  withPx(it, s) {
    return Object.assign({}, it, {
      left: px2(it.mmX * s),
      top: px2(it.mmY * s),
      w: px2(it.mmW * s),
      h: px2(it.mmH * s)
    })
  },

  selView(items, id) {
    const it = items.find((x) => x.id === (id || this.data.selId))
    if (!it) return null
    return { id: it.id, x: one(it.mmX), y: one(it.mmY), w: one(it.mmW), h: one(it.mmH) }
  },

  /* ---------- 选中 ---------- */

  select(id) {
    const items = this.data.items
    const it = items.find((x) => x.id === id)
    if (!it) return
    this.setData({ selId: id, sel: this.selView(items, id) })
    // 检查器卡片出现会让画布变矮，重新量一次再排版，避免纸面盖住顶部
    this.measureStage()
  },

  onFrameTap() {
    if (this.data.selId) {
      this.setData({ selId: '', sel: null })
      this.measureStage()
    }
  },

  onItemTap(e) {
    this.select(e.currentTarget.dataset.id)
  },

  /* ---------- 手势：拖动 / 四角缩放 ---------- */

  onItemStart(e) {
    const id = e.currentTarget.dataset.id
    const it = this.data.items.find((x) => x.id === id)
    if (!it) return
    const t = e.touches[0]
    this.gesture = {
      kind: 'move',
      id,
      sx: t.clientX,
      sy: t.clientY,
      base: { x: it.mmX, y: it.mmY, w: it.mmW, h: it.mmH }
    }
    if (this.data.selId !== id) this.select(id)
  },

  onHandleStart(e) {
    const { id, corner } = e.currentTarget.dataset
    const it = this.data.items.find((x) => x.id === id)
    if (!it) return
    const t = e.touches[0]
    this.gesture = {
      kind: 'resize',
      id,
      corner,
      sx: t.clientX,
      sy: t.clientY,
      base: { x: it.mmX, y: it.mmY, w: it.mmW, h: it.mmH }
    }
  },

  onTouchMove(e) {
    const g = this.gesture
    if (!g || !this.data.pxPerMm) return
    const t = e.touches[0]
    const dx = (t.clientX - g.sx) / this.data.pxPerMm
    const dy = (t.clientY - g.sy) / this.data.pxPerMm
    const next = g.kind === 'move' ? this.nextMove(g, dx, dy) : this.nextResize(g, dx, dy)
    if (next) this.applyItem(next)
  },

  onTouchEnd() {
    this.gesture = null
  },

  nextMove(g, dx, dy) {
    const { pageW, pageH } = this.data
    return {
      id: g.id,
      mmX: clamp(g.base.x + dx, 0, pageW - g.base.w),
      mmY: clamp(g.base.y + dy, 0, pageH - g.base.h),
      mmW: g.base.w,
      mmH: g.base.h
    }
  },

  // 对角固定，按 corner 调整宽高；锁比例时保持原始宽高比
  nextResize(g, dx, dy) {
    const { pageW, pageH, lockAspect } = this.data
    const b = g.base
    const right = g.corner.indexOf('r') >= 0
    const bottom = g.corner.indexOf('b') >= 0
    const maxW = right ? pageW - b.x : b.x + b.w
    const maxH = bottom ? pageH - b.y : b.y + b.h
    let w = right ? b.w + dx : b.w - dx
    let h = bottom ? b.h + dy : b.h - dy

    if (lockAspect) {
      const ratio = b.w / b.h
      if (Math.abs(dx) >= Math.abs(dy)) {
        w = clamp(w, MIN_MM, maxW)
        h = w / ratio
      } else {
        h = clamp(h, MIN_MM, maxH)
        w = h * ratio
      }
      if (w > maxW) {
        w = maxW
        h = w / ratio
      }
      if (h > maxH) {
        h = maxH
        w = h * ratio
      }
      // 太小时整体放大，保持比例（不要单边贴最小值）
      const grow = Math.max(MIN_MM / w, MIN_MM / h)
      if (grow > 1) {
        w *= grow
        h *= grow
      }
    } else {
      w = clamp(w, MIN_MM, maxW)
      h = clamp(h, MIN_MM, maxH)
    }

    const x = right ? b.x : b.x + b.w - w
    const y = bottom ? b.y : b.y + b.h - h
    return {
      id: g.id,
      mmX: clamp(x, 0, pageW - w),
      mmY: clamp(y, 0, pageH - h),
      mmW: w,
      mmH: h
    }
  },

  applyItem(next) {
    const items = this.data.items
    const idx = items.findIndex((x) => x.id === next.id)
    if (idx < 0) return
    const s = this.data.pxPerMm
    const patch = {}
    const fields = ['mmX', 'mmY', 'mmW', 'mmH']
    fields.forEach((f) => {
      patch['items[' + idx + '].' + f] = one(next[f])
    })
    patch['items[' + idx + '].left'] = px2(next.mmX * s)
    patch['items[' + idx + '].top'] = px2(next.mmY * s)
    patch['items[' + idx + '].w'] = px2(next.mmW * s)
    patch['items[' + idx + '].h'] = px2(next.mmH * s)
    if (this.data.selId === next.id) {
      patch.sel = { id: next.id, x: one(next.mmX), y: one(next.mmY), w: one(next.mmW), h: one(next.mmH) }
    }
    this.setData(patch)
  },

  /* ---------- 精确调整 ---------- */

  onNudge(e) {
    const it = this.findSel()
    if (!it) return
    const { pageW, pageH } = this.data
    const dir = e.currentTarget.dataset.dir
    let x = it.mmX
    let y = it.mmY
    if (dir === 'left') x -= 1
    if (dir === 'right') x += 1
    if (dir === 'up') y -= 1
    if (dir === 'down') y += 1
    this.applyItem({
      id: it.id,
      mmX: clamp(x, 0, pageW - it.mmW),
      mmY: clamp(y, 0, pageH - it.mmH),
      mmW: it.mmW,
      mmH: it.mmH
    })
  },

  // X / Y / 宽 / 高 输入框（失焦或回车时生效）
  onNumBlur(e) {
    const it = this.findSel()
    const v = parseFloat(e.detail.value)
    if (!it) return
    if (!isFinite(v)) {
      // 输入非法就按原值刷回去
      return this.applyItem({ id: it.id, mmX: it.mmX, mmY: it.mmY, mmW: it.mmW, mmH: it.mmH })
    }
    const { pageW, pageH } = this.data
    const field = e.currentTarget.dataset.field
    let { mmX: x, mmY: y, mmW: w, mmH: h } = it
    if (field === 'w') {
      w = clamp(v, MIN_MM, pageW)
      if (this.data.lockAspect) h = w * it.mmH / it.mmW
    }
    if (field === 'h') {
      h = clamp(v, MIN_MM, pageH)
      if (this.data.lockAspect) w = h * it.mmW / it.mmH
    }
    if (field === 'x') x = v
    if (field === 'y') y = v
    w = clamp(w, MIN_MM, pageW)
    h = clamp(h, MIN_MM, pageH)
    this.applyItem({
      id: it.id,
      mmX: clamp(x, 0, pageW - w),
      mmY: clamp(y, 0, pageH - h),
      mmW: w,
      mmH: h
    })
  },

  toggleLock(e) {
    this.setData({ lockAspect: !!e.detail.value })
  },

  removeSel() {
    const id = this.data.selId
    if (!id) return
    this.setData({ items: this.data.items.filter((x) => x.id !== id), selId: '', sel: null })
    this.measureStage()
  },

  findSel() {
    return this.data.items.find((x) => x.id === this.data.selId)
  },

  /* ---------- 纸面 ---------- */

  onSizeBlur(e) {
    const { pageW, pageH } = this.data
    const field = e.currentTarget.dataset.field
    const v = parseFloat(e.detail.value)
    if (!isFinite(v) || v < 20 || v > 1000) {
      this.setData({ wInput: String(pageW), hInput: String(pageH) })
      return
    }
    this.setPage(field === 'w' ? v : pageW, field === 'h' ? v : pageH)
  },

  pickPreset(e) {
    const p = PRESETS[Number(e.currentTarget.dataset.i)]
    if (p) this.setPage(p.w, p.h)
  },

  setPage(w, h) {
    // 换纸面时把已有图片等比收进新范围，避免出现框外内容
    const scale = Math.min(1, w / this.data.pageW, h / this.data.pageH)
    const items = this.data.items.map((it) => {
      const mmW = Math.min(w, it.mmW * scale)
      const mmH = Math.min(h, it.mmH * scale)
      return Object.assign({}, it, {
        mmW,
        mmH,
        mmX: clamp(it.mmX * scale, 0, w - mmW),
        mmY: clamp(it.mmY * scale, 0, h - mmH)
      })
    })
    this.setData({ pageW: w, pageH: h, wInput: String(w), hInput: String(h), items }, () => this.relayout())
  },

  /* ---------- 添加图片 ---------- */

  addImages() {
    const room = MAX_ITEMS - this.data.items.length
    if (room <= 0) return this.toast('最多放 ' + MAX_ITEMS + ' 张')
    wx.chooseMedia({
      count: Math.min(9, room),
      mediaType: ['image'],
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: (res) => this.insertFiles(res.tempFiles.map((f) => f.tempFilePath))
    })
  },

  insertFiles(paths) {
    let pending = paths.length
    const added = []
    const done = () => {
      pending -= 1
      if (pending > 0) return
      this.setData({ items: this.data.items.concat(added) }, () => {
        this.relayout()
        if (added.length) this.select(added[added.length - 1].id)
      })
    }
    paths.forEach((path, i) => {
      wx.getImageInfo({
        src: path,
        success: (info) => {
          const { pageW, pageH } = this.data
          const maxW = pageW * 0.55
          const maxH = pageH * 0.45
          let mmW = maxW
          let mmH = mmW * info.height / info.width
          if (mmH > maxH) {
            mmH = maxH
            mmW = mmH * info.width / info.height
          }
          const off = (i - (paths.length - 1) / 2) * 6
          added.push({
            id: `${Date.now()}-${i}-${Math.random().toString(16).slice(2, 6)}`,
            path,
            mmW: one(mmW),
            mmH: one(mmH),
            mmX: one(clamp((pageW - mmW) / 2 + off, 0, pageW - mmW)),
            mmY: one(clamp((pageH - mmH) / 2 + off, 0, pageH - mmH)),
            left: 0,
            top: 0,
            w: 0,
            h: 0
          })
          done()
        },
        fail: done
      })
    })
  },

  /* ---------- 导出：一张 300dpi 图，图片和 PDF 共用 ---------- */

  render() {
    return new Promise((resolve, reject) => {
      if (!this.data.items.length) return reject(new Error('empty'))
      wx.createSelectorQuery()
        .select('#printCanvas')
        .fields({ node: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node
          if (!canvas) return reject(new Error('canvas'))
          const k = DPI / MM_PER_INCH
          const pw = Math.round(this.data.pageW * k)
          const ph = Math.round(this.data.pageH * k)
          canvas.width = pw
          canvas.height = ph
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, pw, ph)

          const images = this.data.items.map(
            (it) => new Promise((ok) => {
              const img = canvas.createImage()
              img.onload = () => ok({ img, it })
              img.onerror = () => ok(null)
              img.src = it.path
            })
          )

          Promise.all(images).then((loaded) => {
            loaded.forEach((entry) => {
              if (!entry) return
              const { img, it } = entry
              ctx.drawImage(img, it.mmX * k, it.mmY * k, it.mmW * k, it.mmH * k)
            })
            wx.canvasToTempFilePath(
              {
                canvas,
                x: 0,
                y: 0,
                width: pw,
                height: ph,
                destWidth: pw,
                destHeight: ph,
                fileType: 'jpg',
                quality: 0.95,
                success: (r) => resolve({ path: r.tempFilePath, pw, ph }),
                fail: () => reject(new Error('export'))
              },
              this
            )
          })
        })
    })
  },

  saveToAlbum() {
    if (this.data.busy) return
    this.setData({ busy: true })
    this.render()
      .then(({ path }) => {
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: () => {
            this.setData({ busy: false })
            wx.showModal({
              title: '已存到相册',
              content: '去相册打开这张图去打印：纸张选 A4、缩放选「实际大小 / 100%」，不要用「适应页面」。',
              showCancel: false
            })
          },
          fail: (err) => {
            this.setData({ busy: false })
            if (err.errMsg && err.errMsg.indexOf('auth') >= 0) {
              wx.showModal({
                title: '需要相册权限',
                content: '保存图片需要允许「保存到相册」，去设置里打开即可。',
                confirmText: '去设置',
                success: (r) => r.confirm && wx.openSetting()
              })
            } else {
              this.toast('保存失败，换个方式试试 PDF')
            }
          }
        })
      })
      .catch(() => this.exportFail())
  },

  openPdf() {
    if (this.data.busy) return
    this.setData({ busy: true })
    this.render()
      .then(({ path, pw, ph }) => {
        const fs = wx.getFileSystemManager()
        const jpeg = wx.base64ToArrayBuffer(fs.readFileSync(path, 'base64'))
        const wpt = this.data.pageW * 72 / MM_PER_INCH
        const hpt = this.data.pageH * 72 / MM_PER_INCH
        const file = wx.env.USER_DATA_PATH + '/photo-' + Date.now() + '.pdf'
        fs.writeFile({
          filePath: file,
          data: buildPdf(jpeg, pw, ph, wpt, hpt),
          success: () => {
            this.setData({ busy: false })
            wx.openDocument({
              filePath: file,
              fileType: 'pdf',
              showMenu: true,
              success: () => this.toast('用右上角菜单「转发」或系统打印，选实际大小', 3600),
              fail: () => this.toast('打不开 PDF，可以改用「存到相册」', 3000)
            })
          },
          fail: () => this.exportFail()
        })
      })
      .catch(() => this.exportFail())
  },

  exportFail() {
    this.setData({ busy: false })
    this.toast(this.data.items.length ? '导出失败，重试一次' : '先添加图片')
  },

  toast(msg, ms) {
    wx.showToast({ title: msg, icon: 'none', duration: ms || 2200 })
  }
})

/* ---------- 最小 PDF：一页、一张 JPEG、尺寸按毫米精确 ---------- */
function buildPdf(jpeg, iw, ih, pw, ph) {
  const chunks = []
  const offsets = []
  let size = 0
  const push = (data) => {
    chunks.push(data)
    size += data.length
  }
  const text = (s) => {
    const u = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff
    return u
  }
  const obj = (head) => {
    offsets.push(size)
    push(text(head))
  }
  const f = (v) => v.toFixed(3)
  const content = 'q ' + f(pw) + ' 0 0 ' + f(ph) + ' 0 0 cm /Im0 Do Q\n'

  push(text('%PDF-1.4\n'))
  obj('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n')
  obj('2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1/MediaBox[0 0 ' + f(pw) + ' ' + f(ph) + ']>>\nendobj\n')
  obj('3 0 obj\n<</Type/Page/Parent 2 0 R/Resources<</XObject<</Im0 4 0 R>>/ProcSet[/PDF/ImageC]>>/Contents 5 0 R>>\nendobj\n')
  obj(
    '4 0 obj\n<</Type/XObject/Subtype/Image/Width ' + iw + '/Height ' + ih +
    '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' + jpeg.byteLength + '>>\nstream\n'
  )
  push(new Uint8Array(jpeg))
  push(text('\nendstream\nendobj\n'))
  obj('5 0 obj\n<</Length ' + content.length + '>>\nstream\n' + content + 'endstream\nendobj\n')

  const start = size
  let xref = 'xref\n0 6\n0000000000 65535 f \n'
  offsets.forEach((o) => {
    xref += String(o).padStart(10, '0') + ' 00000 n \n'
  })
  push(text(xref))
  push(text('trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n' + start + '\n%%EOF\n'))

  const out = new Uint8Array(size)
  let at = 0
  chunks.forEach((c) => {
    out.set(c, at)
    at += c.length
  })
  return out.buffer
}
