export let interrupted = 0
export async function CreateMLCEngine() {
  return {
    unload: async () => {},
    interruptGenerate: async () => { interrupted++ },
    chat: { completions: { create: async () => (async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] }
      await new Promise(resolve => setTimeout(resolve, 5))
      yield { choices: [{ delta: { content: ' there' } }] }
    })() } }
  }
}
