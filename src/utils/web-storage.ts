type StorageName = 'localStorage' | 'sessionStorage'
const nodeProcess = (globalThis as typeof globalThis & {
  process?: { versions?: { node?: string } }
}).process
const isNodeRuntime = !!nodeProcess?.versions?.node

function isStorageLike(value: unknown): value is Storage {
  return !!value
    && typeof value === 'object'
    && typeof (value as Storage).getItem === 'function'
    && typeof (value as Storage).setItem === 'function'
    && typeof (value as Storage).removeItem === 'function'
}

export function getWebStorage(name: StorageName): Storage | null {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)

  if (descriptor && 'value' in descriptor && isStorageLike(descriptor.value)) {
    return descriptor.value
  }

  if (isNodeRuntime) {
    if (name === 'sessionStorage') {
      try {
        const storage = globalThis.sessionStorage
        if (isStorageLike(storage)) {
          return storage
        }
      } catch {
        return null
      }
    }

    return null
  }

  try {
    const storage = globalThis[name]
    if (isStorageLike(storage)) {
      return storage
    }
  } catch {
    return null
  }

  return null
}
