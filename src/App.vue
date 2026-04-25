<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface UserProfile {
  id: string
  name: string
  projects: string[]
  records: Record<string, string[]>
}

const STORAGE_KEY = 'daily-checkin-h5-v1'
const weekNames = ['一', '二', '三', '四', '五', '六', '日']

const state = ref<{
  users: UserProfile[]
  selectedUserId: string
  selectedDate: string
}>({
  users: [],
  selectedUserId: '',
  selectedDate: formatDate(new Date())
})

const currentMonth = ref(firstDayOfMonth(state.value.selectedDate))
const userNameInput = ref('')
const projectNameInput = ref('')
const showUserMenu = ref(false)
const showAddUserModal = ref(false)
const showDeleteUserModal = ref(false)
const showAddProjectModal = ref(false)
const showDeleteProjectModal = ref(false)
const pendingDeleteUserId = ref('')
const pendingDeleteProjectName = ref('')
const expandedSummaryProjects = ref<Record<string, boolean>>({})

initializeFromStorage()

const selectedUser = computed(() =>
  state.value.users.find((user) => user.id === state.value.selectedUserId)
)

const selectedDateRecord = computed(() => {
  if (!selectedUser.value) return []
  return selectedUser.value.records[state.value.selectedDate] ?? []
})

const userProjectSummary = computed(() => {
  const user = selectedUser.value
  if (!user) return []
  return user.projects.map((projectName) => {
    const doneDays = Object.values(user.records).filter((dayItems) =>
      dayItems.includes(projectName)
    ).length
    return { projectName, doneDays }
  })
})

const monthLabel = computed(() => {
  const date = new Date(currentMonth.value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}年${month}月`
})

const monthDays = computed(() => {
  const firstDate = new Date(currentMonth.value)
  const startWeekday = (firstDate.getDay() + 6) % 7
  const year = firstDate.getFullYear()
  const month = firstDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<{ key: string; date: string; day: number; isCurrentMonth: boolean }> = []

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ key: `empty-${i}`, date: '', day: 0, isCurrentMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = formatDate(new Date(year, month, day))
    cells.push({ key: date, date, day, isCurrentMonth: true })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, date: '', day: 0, isCurrentMonth: false })
  }
  return cells
})

watch(
  state,
  (newState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
  },
  { deep: true }
)

function initializeFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as typeof state.value
      if (parsed.users?.length) {
        state.value = parsed
        currentMonth.value = firstDayOfMonth(state.value.selectedDate)
        return
      }
    } catch {
      // Use default data below if parsing fails.
    }
  }

  const defaultUser: UserProfile = {
    id: createId(),
    name: '用户A',
    projects: ['跳绳', '拍球', '认字'],
    records: {}
  }
  state.value.users = [defaultUser]
  state.value.selectedUserId = defaultUser.id
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function firstDayOfMonth(dateText: string) {
  const date = new Date(dateText)
  return formatDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

function addUser() {
  const name = userNameInput.value.trim()
  if (!name) return
  if (state.value.users.some((user) => user.name === name)) return
  const nextUser: UserProfile = { id: createId(), name, projects: [], records: {} }
  state.value.users.push(nextUser)
  state.value.selectedUserId = nextUser.id
  userNameInput.value = ''
  showAddUserModal.value = false
}

function addProject() {
  if (!selectedUser.value) return
  const name = projectNameInput.value.trim()
  if (!name) return
  if (selectedUser.value.projects.includes(name)) return
  selectedUser.value.projects.push(name)
  projectNameInput.value = ''
  showAddProjectModal.value = false
}

function selectUser(userId: string) {
  state.value.selectedUserId = userId
  showUserMenu.value = false
  expandedSummaryProjects.value = {}
}

function openAddUserModal() {
  showUserMenu.value = false
  userNameInput.value = ''
  showAddUserModal.value = true
}

function askDeleteUser(userId: string) {
  pendingDeleteUserId.value = userId
  showDeleteUserModal.value = true
}

function confirmDeleteUser() {
  const userId = pendingDeleteUserId.value
  if (!userId) return
  const index = state.value.users.findIndex((user) => user.id === userId)
  if (index < 0) return
  state.value.users.splice(index, 1)
  if (!state.value.users.length) {
    const fallback: UserProfile = { id: createId(), name: '用户A', projects: [], records: {} }
    state.value.users = [fallback]
  }
  if (!state.value.users.some((user) => user.id === state.value.selectedUserId)) {
    state.value.selectedUserId = state.value.users[0].id
  }
  pendingDeleteUserId.value = ''
  showDeleteUserModal.value = false
}

function askDeleteProject(projectName: string) {
  pendingDeleteProjectName.value = projectName
  showDeleteProjectModal.value = true
}

function confirmDeleteProject() {
  const user = selectedUser.value
  const projectName = pendingDeleteProjectName.value
  if (!user || !projectName) return
  user.projects = user.projects.filter((project) => project !== projectName)
  Object.keys(user.records).forEach((dateKey) => {
    user.records[dateKey] = user.records[dateKey].filter((project) => project !== projectName)
  })
  delete expandedSummaryProjects.value[projectName]
  pendingDeleteProjectName.value = ''
  showDeleteProjectModal.value = false
}

function toggleSummaryProject(projectName: string) {
  expandedSummaryProjects.value[projectName] = !expandedSummaryProjects.value[projectName]
}

function isSummaryProjectExpanded(projectName: string) {
  return Boolean(expandedSummaryProjects.value[projectName])
}

function getProjectMonthlyStats(projectName: string) {
  const user = selectedUser.value
  if (!user) return []
  const monthlyMap = new Map<string, number>()
  Object.entries(user.records).forEach(([date, projects]) => {
    if (!projects.includes(projectName)) return
    const yearMonth = date.slice(0, 7)
    monthlyMap.set(yearMonth, (monthlyMap.get(yearMonth) ?? 0) + 1)
  })
  return Array.from(monthlyMap.entries())
    .map(([yearMonth, count]) => ({ yearMonth, count }))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}

function jumpToYearMonth(yearMonth: string) {
  const [yearText, monthText] = yearMonth.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!year || !month) return
  const target = new Date(year, month - 1, 1)
  currentMonth.value = formatDate(target)
  state.value.selectedDate = formatDate(target)
}

function closeAllModals() {
  showAddUserModal.value = false
  showDeleteUserModal.value = false
  showAddProjectModal.value = false
  showDeleteProjectModal.value = false
  pendingDeleteUserId.value = ''
  pendingDeleteProjectName.value = ''
}

function pickDate(date: string) {
  if (!date || !selectedUser.value) return
  state.value.selectedDate = date
}

function toggleRecord(projectName: string) {
  if (!selectedUser.value) return
  const dateKey = state.value.selectedDate
  const current = selectedUser.value.records[dateKey] ?? []
  if (current.includes(projectName)) {
    selectedUser.value.records[dateKey] = current.filter((name) => name !== projectName)
    return
  }
  selectedUser.value.records[dateKey] = [...current, projectName]
}

function isProjectDone(projectName: string) {
  return selectedDateRecord.value.includes(projectName)
}

function getCompletionRatio(date: string) {
  if (!selectedUser.value || !date) return 0
  const total = selectedUser.value.projects.length
  if (!total) return 0
  const done = selectedUser.value.records[date]?.length ?? 0
  return Math.min(done / total, 1)
}

function ratioBackground(date: string) {
  const ratio = getCompletionRatio(date)
  if (ratio <= 0) return ''
  const degree = Math.round(ratio * 360)
  return `conic-gradient(#ff5f67 0deg ${degree}deg, #d8dbe8 ${degree}deg 360deg)`
}

function previousMonth() {
  const date = new Date(currentMonth.value)
  currentMonth.value = formatDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))
}

function nextMonth() {
  const date = new Date(currentMonth.value)
  currentMonth.value = formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))
}
</script>

<template>
  <main class="page">
    <section class="card">
      <h1>每日打卡</h1>
      <div class="user-select">
        <button class="input user-select-btn" @click="showUserMenu = !showUserMenu">
          <span>{{ selectedUser?.name || '请选择用户' }}</span>
          <span>▾</span>
        </button>
        <div v-if="showUserMenu" class="user-menu">
          <div v-for="user in state.users" :key="user.id" class="menu-row">
            <button class="menu-item" @click="selectUser(user.id)">
              {{ user.name }}
            </button>
            <button class="close-mini" @click="askDeleteUser(user.id)">×</button>
          </div>
          <button class="menu-add" @click="openAddUserModal">+ 新增用户</button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="calendar-head">
        <button class="month-btn" @click="previousMonth">上月</button>
        <strong>{{ monthLabel }}</strong>
        <button class="month-btn" @click="nextMonth">下月</button>
      </div>
      <div class="week-row">
        <span v-for="name in weekNames" :key="name">{{ name }}</span>
      </div>
      <div class="calendar-grid">
        <button
          v-for="cell in monthDays"
          :key="cell.key"
          class="day-wrap"
          :class="{ selected: cell.date === state.selectedDate }"
          :disabled="!cell.isCurrentMonth"
          @click="pickDate(cell.date)"
        >
          <span class="day-ring" :style="{ background: ratioBackground(cell.date) }">
            <span class="day-inner">{{ cell.day || '' }}</span>
          </span>
        </button>
      </div>
    </section>

    <section class="card" v-if="selectedUser">
      <p class="date-title">已选日期：{{ state.selectedDate }}</p>
      <p class="hint">点击项目即可打卡/取消，日历外圈按完成比例高亮（例：1/3）。</p>
      <div class="project-list">
        <div v-for="project in selectedUser.projects" :key="project" class="project-chip">
          <button class="project-item" :class="{ done: isProjectDone(project) }" @click="toggleRecord(project)">
            {{ project }}
          </button>
          <button class="close-mini" @click="askDeleteProject(project)">×</button>
        </div>
        <button class="project-add" @click="showAddProjectModal = true">+</button>
      </div>
      <p v-if="!selectedUser.projects.length" class="hint">当前用户暂无项目，请点击 + 新增打卡项目。</p>
    </section>

    <section class="card" v-if="selectedUser">
      <p class="date-title">{{ selectedUser.name }} 项目汇总</p>
      <div class="summary-list">
        <div v-for="summary in userProjectSummary" :key="summary.projectName">
          <button
            class="summary-row"
            :class="{ active: isSummaryProjectExpanded(summary.projectName) }"
            @click="toggleSummaryProject(summary.projectName)"
          >
            <span>{{ summary.projectName }}</span>
            <strong>{{ summary.doneDays }} 天</strong>
          </button>
          <div v-if="isSummaryProjectExpanded(summary.projectName)" class="monthly-panel">
            <p class="hint">{{ summary.projectName }} - 月度分布</p>
            <div v-if="getProjectMonthlyStats(summary.projectName).length" class="monthly-list">
              <button
                v-for="month in getProjectMonthlyStats(summary.projectName)"
                :key="month.yearMonth"
                class="monthly-row"
                @click="jumpToYearMonth(month.yearMonth)"
              >
                <span>{{ month.yearMonth }}</span>
                <strong>{{ month.count }} 次</strong>
              </button>
            </div>
            <p v-else class="hint">该项目还没有打卡数据。</p>
          </div>
        </div>
      </div>
      <p v-if="!userProjectSummary.length" class="hint">暂无可统计项目。</p>
    </section>
  </main>

  <div
    v-if="showAddUserModal || showDeleteUserModal || showAddProjectModal || showDeleteProjectModal"
    class="modal-mask"
    @click.self="closeAllModals"
  >
    <div v-if="showAddUserModal" class="modal-card">
      <p class="date-title">新增用户</p>
      <input v-model="userNameInput" class="input" placeholder="输入用户名称" />
      <div class="row">
        <button class="btn ghost" @click="closeAllModals">取消</button>
        <button class="btn" @click="addUser">确定</button>
      </div>
    </div>

    <div v-if="showDeleteUserModal" class="modal-card">
      <p class="date-title">删除确认</p>
      <p class="hint">确定删除该用户吗？该用户的项目和记录会一起删除。</p>
      <div class="row">
        <button class="btn ghost" @click="closeAllModals">取消</button>
        <button class="btn" @click="confirmDeleteUser">确定</button>
      </div>
    </div>

    <div v-if="showAddProjectModal" class="modal-card">
      <p class="date-title">新增项目</p>
      <input v-model="projectNameInput" class="input" placeholder="输入项目名称，如：跳绳" />
      <div class="row">
        <button class="btn ghost" @click="closeAllModals">取消</button>
        <button class="btn" @click="addProject">确定</button>
      </div>
    </div>

    <div v-if="showDeleteProjectModal" class="modal-card">
      <p class="date-title">删除确认</p>
      <p class="hint">确定删除项目“{{ pendingDeleteProjectName }}”吗？</p>
      <div class="row">
        <button class="btn ghost" @click="closeAllModals">取消</button>
        <button class="btn" @click="confirmDeleteProject">确定</button>
      </div>
    </div>
  </div>
</template>
