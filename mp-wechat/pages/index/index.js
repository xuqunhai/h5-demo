Page({
  data: {
    slots: [
      { key: 'checkin', title: '每日打卡', sub: '习惯与日历', filled: true, url: '/pages/checkin/checkin' },
      { key: 'print', title: '打印图片', sub: '照片排版到 A4', filled: true, url: '/pages/print/print' },
      { key: 'p2', title: '敬请期待', sub: '预留入口', filled: false },
      { key: 'p3', title: '敬请期待', sub: '预留入口', filled: false },
      { key: 'p4', title: '敬请期待', sub: '预留入口', filled: false },
      { key: 'p5', title: '敬请期待', sub: '预留入口', filled: false },
      { key: 'p6', title: '敬请期待', sub: '预留入口', filled: false },
      { key: 'p7', title: '敬请期待', sub: '预留入口', filled: false },
      { key: 'p8', title: '敬请期待', sub: '预留入口', filled: false }
    ]
  },

  onSlotTap(e) {
    const slot = this.data.slots[Number(e.currentTarget.dataset.index)]
    if (!slot || !slot.url) return
    wx.navigateTo({ url: slot.url })
  }
})
