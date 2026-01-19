import { useState } from 'react'
import './App.css'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="app">
      <header className="app__header">
        <h1>Chomp</h1>
        <p>Vite + React + Express</p>
      </header>

      <section className="card">
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          Count is {count}
        </button>
      </section>
    </main>
  )
}
