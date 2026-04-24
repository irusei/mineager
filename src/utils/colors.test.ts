import { describe, it, expect } from 'vitest'
import { getConsoleColor, getStatusColor } from './colors'

describe('getStatusColor', () => {
    it('online status', () => {
        expect(getStatusColor('Online')).toBe('bg-green')
    })

    it('red status', () => {
        expect(getStatusColor('Offline')).toBe('bg-red')
    })
})

describe('getConsoleColor', () => {
    it('command prefix', () => {
        expect(getConsoleColor('> command')).toBe('text-mauve')
    })

    it('info log line', () => {
        expect(getConsoleColor('[20:15:30] [Server thread/INFO]: Starting server')).toBe('text-text')
    })

    it('warning line', () => {
        expect(getConsoleColor('WARNING: aertgijgsehtiaj')).toBe('text-mauve')
    })

    it('default line', () => {
        expect(getConsoleColor('Some regular log line')).toBe('text-green')
    })
})
