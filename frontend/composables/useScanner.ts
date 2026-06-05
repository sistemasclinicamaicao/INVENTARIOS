import { ref, type Ref } from 'vue'

export function useScanner(onScan?: (code: string) => void) {
  const scanInput = ref('') as Ref<string>

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && scanInput.value.trim()) {
      const code = scanInput.value.trim()
      onScan?.(code)
      scanInput.value = ''
    }
  }

  return { scanInput, handleKeydown }
}
