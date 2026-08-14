import { createSignal } from 'solid-js'

const ALPHABET_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ALPHABET_LOWER = 'abcdefghijklmnopqrstuvwxyz'
const ALPHABET_SIZE = ALPHABET_UPPER.length
const MAX_SHIFT = ALPHABET_SIZE - 1

function caesarShift(text: string, shift: number) {
  const normalizedShift = ((shift % ALPHABET_SIZE) + ALPHABET_SIZE) % ALPHABET_SIZE

  return text
    .split('')
    .map((char) => {
      const upperIndex = ALPHABET_UPPER.indexOf(char)
      if (upperIndex !== -1) {
        return ALPHABET_UPPER[(upperIndex + normalizedShift) % ALPHABET_SIZE]
      }

      const lowerIndex = ALPHABET_LOWER.indexOf(char)
      if (lowerIndex !== -1) {
        return ALPHABET_LOWER[(lowerIndex + normalizedShift) % ALPHABET_SIZE]
      }

      return char
    })
    .join('')
}

export default function CaesarCipherDemo() {
  const [text, setText] = createSignal('')
  const [shift, setShift] = createSignal(4)
  const [result, setResult] = createSignal('')

  const encrypt = () => setResult(caesarShift(text(), shift()))

  const blockNonDigitKeys = (e: KeyboardEvent) => {
    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
      e.preventDefault()
    }
  }

  const handleShiftInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const digitsOnly = e.currentTarget.value.replace(/\D/g, '')
    const value = digitsOnly === '' ? 0 : Math.min(MAX_SHIFT, Number(digitsOnly))
    setShift(value)
    e.currentTarget.value = String(value)
  }

  return (
    <div class="p-4 rounded-lg border border-black/15 dark:border-white/20">
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label for="caesar-text" class="text-sm opacity-75">
            Texto
          </label>
          <input
            id="caesar-text"
            type="text"
            value={text()}
            onInput={(e) => setText(e.currentTarget.value)}
            placeholder="Escribí un mensaje..."
            autocomplete="off"
            spellcheck={false}
            class="w-full px-3 py-1.5 rounded outline-none placeholder-neutral-400 dark:placeholder-neutral-500 text-black dark:text-white bg-black/5 dark:bg-white/10 hover:bg-black/10 hover:dark:bg-white/15 focus:bg-black/10 focus:dark:bg-white/15 border border-black/10 dark:border-white/10 focus:border-black/40 focus:dark:border-white/40"
          />
        </div>

        <div class="flex flex-col gap-1 w-32">
          <label for="caesar-shift" class="text-sm opacity-75">
            Movimientos
          </label>
          <input
            id="caesar-shift"
            type="number"
            min="0"
            max={MAX_SHIFT}
            value={shift()}
            onKeyDown={blockNonDigitKeys}
            onInput={handleShiftInput}
            class="w-full px-3 py-1.5 rounded outline-none text-black dark:text-white bg-black/5 dark:bg-white/10 hover:bg-black/10 hover:dark:bg-white/15 focus:bg-black/10 focus:dark:bg-white/15 border border-black/10 dark:border-white/10 focus:border-black/40 focus:dark:border-white/40"
          />
        </div>

        <button
          onClick={encrypt}
          class="w-fit px-3 py-1.5 border border-black/25 dark:border-white/25 hover:bg-black/5 dark:hover:bg-white/15 blend rounded"
        >
          Cifrar
        </button>

        {result().length > 0 && (
          <div class="flex flex-col gap-1">
            <div class="text-sm opacity-75">Resultado</div>
            <div class="px-3 py-1.5 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 break-all">
              {result()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
