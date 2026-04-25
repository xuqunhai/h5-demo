Page({
  data: {
    slots: [
      { key: 'checkin', title: '每日打卡', sub: '习惯与日历', filled: true },
      { key: 'p1', title: '敬请期待', sub: '预留入口', filled: false },
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
    const index = Number(e.currentTarget.dataset.index)
    if (index !== 0) return
    wx.navigateTo({ url: '/pages/checkin/checkin' })
  }
})
