import { useEffect } from 'react'

export function useClickOutside(ref, onOutsideClick) {
    useEffect(() => {
        function handleClick(event) {
            if (!ref.current || ref.current.contains(event.target)) {
                return
            }
            onOutsideClick?.(event)
        }

        document.addEventListener('mousedown', handleClick)
        document.addEventListener('touchstart', handleClick)

        return () => {
            document.removeEventListener('mousedown', handleClick)
            document.removeEventListener('touchstart', handleClick)
        }
    }, [ref, onOutsideClick])
}
