<script setup lang="ts">
definePageMeta({ layout: false })

const cedula = ref('1234567890')
const password = ref('Admin123!')
const otp = ref('')
const step = ref<'login' | 'otp'>('login')
const sessionToken = ref('')
const error = ref('')
const devOtp = ref('')
const emailHint = ref('')
const loginMessage = ref('')
const apiBase = useApiBase()
const session = useSessionStore()

async function submitLogin() {
  error.value = ''
  try {
    const res = await $fetch<{
      requiresOtp: boolean
      sessionToken: string
      emailHint?: string
      message?: string
      devOtp?: string
    }>(`${apiBase}/auth/login`, {
      method: 'POST',
      body: { cedula: cedula.value, password: password.value },
    })
    sessionToken.value = res.sessionToken
    devOtp.value = res.devOtp ?? ''
    emailHint.value = res.emailHint ?? ''
    loginMessage.value = res.message ?? ''
    step.value = 'otp'
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message
    error.value = msg || 'Error de autenticación'
  }
}

async function submitOtp() {
  error.value = ''
  try {
    const res = await $fetch<{
      accessToken: string
      refreshToken: string
      user: {
        fullName?: string
        roles?: string[]
        permissions?: string[]
      }
    }>(`${apiBase}/auth/verify-otp`, {
      method: 'POST',
      body: { sessionToken: sessionToken.value, otp: otp.value.replace(/\D/g, '').slice(0, 6) },
    })
    if (import.meta.client) {
      localStorage.setItem('accessToken', res.accessToken)
      localStorage.setItem('refreshToken', res.refreshToken)
    }
    session.setFromProfile({
      fullName: res.user?.fullName,
      roles: res.user?.roles ?? [],
      permissions: res.user?.permissions ?? [],
      roleLabel: res.user?.roles?.[0] ?? 'Usuario',
      initials: (res.user?.fullName ?? 'U').slice(0, 2).toUpperCase(),
    })
    const { loadProfile } = useAuth()
    await loadProfile()
    await navigateTo('/')
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string } })?.data?.message
    error.value = msg || 'OTP inválido o expirado. Vuelva a iniciar sesión.'
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-md">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
          +
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-800">Clínica ERP</h1>
          <p class="text-sm text-slate-500">Iniciar sesión (2FA)</p>
        </div>
      </div>

      <form v-if="step === 'login'" class="space-y-4" @submit.prevent="submitLogin">
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Cédula</label>
          <input v-model="cedula" type="text" autocomplete="username" class="w-full p-2 border rounded-lg" required />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-500 mb-1">Contraseña</label>
          <input v-model="password" type="password" autocomplete="current-password" class="w-full p-2 border rounded-lg" required />
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
          Continuar
        </button>
        <p class="text-xs text-slate-400 text-center">Admin: 1234567890 / Admin123!</p>
      </form>

      <form v-else class="space-y-4" @submit.prevent="submitOtp">
        <p class="text-sm text-slate-600">
          {{ loginMessage || (emailHint ? `Ingrese el código enviado a ${emailHint}.` : 'Ingrese el código enviado a su correo.') }}
        </p>
        <p v-if="devOtp" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded">
          Use este código OTP:
          <strong class="block text-center text-lg tracking-widest mt-1">{{ devOtp }}</strong>
        </p>
        <input
          v-model="otp"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="000000"
          class="w-full p-2 border rounded-lg text-center text-lg tracking-widest"
          required
        />
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
          Verificar OTP
        </button>
      </form>
    </div>
  </div>
</template>
