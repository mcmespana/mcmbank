'use client'

import { EmojiPicker } from 'frimousse'

export default function TestFrimousse() {
  return (
    <div>
      {EmojiPicker({ 
        onEmojiSelect: (emoji: string) => console.log(emoji)
      })}
    </div>
  )
}
