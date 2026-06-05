import { defineStore } from 'pinia'

export const useSessionStore = defineStore('session', {
  state: () => ({
    fullName: 'Usuario',
    roleLabel: '',
    initials: 'U',
    notificationCount: 0,
    permissions: [] as string[],
    roles: [] as string[],
    loaded: false,
  }),

  getters: {
    isAdmin: (s) => s.roles.includes('admin'),
    can: (s) => (code: string) =>
      s.roles.includes('admin') ||
      s.permissions.includes('*') ||
      s.permissions.includes(code),
  },

  actions: {
    setFromProfile(profile: {
      fullName?: string
      roleLabel?: string
      initials?: string
      notificationCount?: number
      permissions?: string[]
      roles?: string[]
    }) {
      if (profile.fullName) this.fullName = profile.fullName
      if (profile.roleLabel) this.roleLabel = profile.roleLabel
      if (profile.initials) this.initials = profile.initials
      if (profile.notificationCount != null) {
        this.notificationCount = profile.notificationCount
      }
      if (profile.permissions) this.permissions = profile.permissions
      if (profile.roles) this.roles = profile.roles
      this.loaded = true
    },

    clear() {
      this.fullName = 'Usuario'
      this.roleLabel = ''
      this.initials = 'U'
      this.notificationCount = 0
      this.permissions = []
      this.roles = []
      this.loaded = false
    },
  },
})
