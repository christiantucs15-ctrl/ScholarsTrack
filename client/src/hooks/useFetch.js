import { useState, useEffect, useCallback } from 'react'

// Usage: const { data, loading, error, reload } = useFetch(getSomething)
// "fetcher" must be a function that returns a promise (your api/ functions do).
// If the fetcher needs an argument, wrap it in useCallback so it stays stable:
//   const fetcher = useCallback(() => getOne(id), [id])
export default function useFetch(fetcher) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true

    fetcher()
      .then((res) => {
        if (active) setState({ data: res.data ?? res, loading: false, error: '' })
      })
      .catch((err) => {
        if (active) {
          setState({
            data: null,
            loading: false,
            error: err.response?.data?.message || err.message || 'Something went wrong',
          })
        }
      })

    return () => {
      active = false
    }
  }, [fetcher, tick])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    setTick((t) => t + 1)
  }, [])

  return { ...state, reload }
}