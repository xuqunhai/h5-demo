const STORAGE_KEY = 'daily-checkin-mp-v1'
const weekNames = ['一', '二', '三', '四', '五', '六', '日']

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function firstDayOfMonth(dateText) {
  const date = new Date(dateText)
  return formatDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

Page({
  data: {
    weekNames,
    users: [],
    selectedUserId: '',
    selectedDate: formatDate(new Date()),
    currentMonth: '',
    monthLabel: '',
    monthDays: [],
    selectedUserName: '请选择用户',
    selectedUser: null,
    selectedRecord: [],
    summary: [],
    showUserMenu: false,
    showAddUserModal: false,
    showDeleteUserModal: false,
    showAddProjectModal: false,
    showDeleteProjectModal: false,
    userNameInput: '',
    projectNameInput: '',
    pendingDeleteUserId: '',
    pendingDeleteProjectName: '',
    expandedSummaryProjects: {}
  },

  onLoad() {
    this.setData({ currentMonth: firstDayOfMonth(this.data.selectedDate) })
    this.initializeData()
  },

  initializeData() {
    const saved = wx.getStorageSync(STORAGE_KEY)
    if (saved && saved.users && saved.users.length) {
      this.setData({
        users: saved.users,
        selectedUserId: saved.selectedUserId,
        selectedDate: saved.selectedDate,
        currentMonth: firstDayOfMonth(saved.selectedDate),
        expandedSummaryProjects: {}
      })
    } else {
      const defaultUser = {
        id: createId(),
        name: '用户A',
        projects: ['跳绳', '拍球', '认字'],
        records: {}
      }
      this.setData({
        users: [defaultUser],
        selectedUserId: defaultUser.id
      })
      this.saveStorage()
    }
    this.syncDerivedData()
  },

  saveStorage() {
    wx.setStorageSync(STORAGE_KEY, {
      users: this.data.users,
      selectedUserId: this.data.selectedUserId,
      selectedDate: this.data.selectedDate
    })
  },

  getSelectedUser() {
    return this.data.users.find((item) => item.id === this.data.selectedUserId) || null
  },

  getCompletionRatio(date) {
    const user = this.getSelectedUser()
    if (!user || !date) return 0
    const total = user.projects.length
    if (!total) return 0
    const done = (user.records[date] || []).length
    return Math.min(done / total, 1)
  },

  getMonthDays(currentMonth) {
    const firstDate = new Date(currentMonth)
    const startWeekday = (firstDate.getDay() + 6) % 7
    const year = firstDate.getFullYear()
    const month = firstDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []

    for (let i = 0; i < startWeekday; i += 1) {
      cells.push({ key: `empty-${i}`, date: '', day: 0, isCurrentMonth: false, ratio: 0 })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = formatDate(new Date(year, month, day))
      cells.push({
        key: date,
        date,
        day,
        isCurrentMonth: true,
        ratio: this.getCompletionRatio(date)
      })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `tail-${cells.length}`, date: '', day: 0, isCurrentMonth: false, ratio: 0 })
    }
    return cells
  },

  getProjectMonthlyStats(user, projectName) {
    const monthlyMap = new Map()
    Object.keys(user.records).forEach((date) => {
      const projects = user.records[date] || []
      if (!projects.includes(projectName)) return
      const ym = date.slice(0, 7)
      monthlyMap.set(ym, (monthlyMap.get(ym) || 0) + 1)
    })
    return Array.from(monthlyMap.entries())
      .map(([yearMonth, count]) => ({ yearMonth, count }))
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
  },

  syncDerivedData() {
    const date = new Date(this.data.currentMonth)
    const monthLabel = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`
    const monthDays = this.getMonthDays(this.data.currentMonth)
    const selectedUser = this.getSelectedUser()
    const selectedRecord = selectedUser ? selectedUser.records[this.data.selectedDate] || [] : []
    const summary = selectedUser
      ? selectedUser.projects.map((projectName) => {
          const doneDays = Object.values(selectedUser.records).filter((dayItems) =>
            dayItems.includes(projectName)
          ).length
          return {
            projectName,
            doneDays,
            expanded: Boolean(this.data.expandedSummaryProjects[projectName]),
            monthlyStats: this.getProjectMonthlyStats(selectedUser, projectName)
          }
        })
      : []
    this.setData({
      monthLabel,
      monthDays,
      selectedUser,
      selectedUserName: selectedUser ? selectedUser.name : '请选择用户',
      selectedRecord,
      summary
    })
  },

  toggleUserMenu() {
    this.setData({ showUserMenu: !this.data.showUserMenu })
  },

  selectUser(e) {
    this.setData({
      selectedUserId: e.currentTarget.dataset.userid,
      showUserMenu: false,
      expandedSummaryProjects: {}
    })
    this.syncDerivedData()
    this.saveStorage()
  },

  openAddUserModal() {
    this.setData({ showUserMenu: false, showAddUserModal: true, userNameInput: '' })
  },

  onUserNameInput(e) {
    this.setData({ userNameInput: e.detail.value })
  },

  confirmAddUser() {
    const name = (this.data.userNameInput || '').trim()
    if (!name) return
    if (this.data.users.some((user) => user.name === name)) return
    const nextUser = { id: createId(), name, projects: [], records: {} }
    this.setData({
      users: [...this.data.users, nextUser],
      selectedUserId: nextUser.id,
      userNameInput: '',
      showAddUserModal: false,
      expandedSummaryProjects: {}
    })
    this.syncDerivedData()
    this.saveStorage()
  },

  askDeleteUser(e) {
    this.setData({
      pendingDeleteUserId: e.currentTarget.dataset.userid,
      showDeleteUserModal: true
    })
  },

  confirmDeleteUser() {
    const userId = this.data.pendingDeleteUserId
    let users = this.data.users.filter((user) => user.id !== userId)
    if (!users.length) {
      users = [{ id: createId(), name: '用户A', projects: [], records: {} }]
    }
    let selectedUserId = this.data.selectedUserId
    if (!users.some((item) => item.id === selectedUserId)) {
      selectedUserId = users[0].id
    }
    this.setData({
      users,
      selectedUserId,
      showDeleteUserModal: false,
      pendingDeleteUserId: '',
      expandedSummaryProjects: {}
    })
    this.syncDerivedData()
    this.saveStorage()
  },

  openAddProjectModal() {
    this.setData({ showAddProjectModal: true, projectNameInput: '' })
  },

  onProjectNameInput(e) {
    this.setData({ projectNameInput: e.detail.value })
  },

  confirmAddProject() {
    const user = this.getSelectedUser()
    const name = (this.data.projectNameInput || '').trim()
    if (!user || !name || user.projects.includes(name)) return
    const users = this.data.users.map((item) =>
      item.id === user.id ? { ...item, projects: [...item.projects, name] } : item
    )
    this.setData({ users, projectNameInput: '', showAddProjectModal: false })
    this.syncDerivedData()
    this.saveStorage()
  },

  askDeleteProject(e) {
    this.setData({
      pendingDeleteProjectName: e.currentTarget.dataset.project,
      showDeleteProjectModal: true
    })
  },

  confirmDeleteProject() {
    const user = this.getSelectedUser()
    const projectName = this.data.pendingDeleteProjectName
    if (!user || !projectName) return
    const users = this.data.users.map((item) => {
      if (item.id !== user.id) return item
      const projects = item.projects.filter((project) => project !== projectName)
      const records = {}
      Object.keys(item.records).forEach((dateKey) => {
        records[dateKey] = item.records[dateKey].filter((project) => project !== projectName)
      })
      return { ...item, projects, records }
    })
    const expanded = { ...this.data.expandedSummaryProjects }
    delete expanded[projectName]
    this.setData({
      users,
      pendingDeleteProjectName: '',
      showDeleteProjectModal: false,
      expandedSummaryProjects: expanded
    })
    this.syncDerivedData()
    this.saveStorage()
  },

  closeAllModals() {
    this.setData({
      showAddUserModal: false,
      showDeleteUserModal: false,
      showAddProjectModal: false,
      showDeleteProjectModal: false,
      pendingDeleteUserId: '',
      pendingDeleteProjectName: ''
    })
  },

  noop() {},

  pickDate(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this.setData({ selectedDate: date })
    this.syncDerivedData()
    this.saveStorage()
  },

  toggleRecord(e) {
    const project = e.currentTarget.dataset.project
    const user = this.getSelectedUser()
    if (!user || !project) return
    const dateKey = this.data.selectedDate
    const current = user.records[dateKey] || []
    const nextList = current.includes(project)
      ? current.filter((name) => name !== project)
      : [...current, project]
    const users = this.data.users.map((item) =>
      item.id === user.id ? { ...item, records: { ...item.records, [dateKey]: nextList } } : item
    )
    this.setData({ users })
    this.syncDerivedData()
    this.saveStorage()
  },

  previousMonth() {
    const date = new Date(this.data.currentMonth)
    this.setData({ currentMonth: formatDate(new Date(date.getFullYear(), date.getMonth() - 1, 1)) })
    this.syncDerivedData()
  },

  nextMonth() {
    const date = new Date(this.data.currentMonth)
    this.setData({ currentMonth: formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 1)) })
    this.syncDerivedData()
  },

  toggleSummaryProject(e) {
    const projectName = e.currentTarget.dataset.project
    const expanded = { ...this.data.expandedSummaryProjects }
    expanded[projectName] = !expanded[projectName]
    this.setData({ expandedSummaryProjects: expanded })
    this.syncDerivedData()
  },

  jumpToYearMonth(e) {
    const yearMonth = e.currentTarget.dataset.ym
    const [yearText, monthText] = yearMonth.split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    if (!year || !month) return
    const target = new Date(year, month - 1, 1)
    this.setData({
      currentMonth: formatDate(target),
      selectedDate: formatDate(target)
    })
    this.syncDerivedData()
    this.saveStorage()
  }
})
