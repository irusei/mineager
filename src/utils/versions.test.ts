import { describe, it, expect } from 'vitest'
import { sortVersions } from './versions.ts'

describe('sortVersions', () => {
    it('sorts simple versions ascending', () => {
        const versions = ['1.7', '1.21', '1.10', '1.9', '1.8']
        const sorted = sortVersions(versions)
        expect(sorted).toEqual(['1.7', '1.8', '1.9', '1.10', '1.21'])
    })

    it('sorts versions with patch numbers', () => {
        const versions = ['1.7.10', '1.7.2', '1.7.1', '1.7']
        const sorted = sortVersions(versions)
        expect(sorted).toEqual(['1.7', '1.7.1', '1.7.2', '1.7.10'])
    })

    it('puts prerelease versions last', () => {
        const versions = ['1.20', '1.21', '1.21-pre4', '1.20-pre4']
        const sorted = sortVersions(versions)
        expect(sorted).toEqual(['1.20', '1.20-pre4', '1.21', '1.21-pre4'])
    })

    it('sorts mixed versions correctly', () => {
        const versions = [
            '1.7',
            '1.21',
            '1.21.22',
            '1.24-pre1',
            '1.24-pre4',
            '1.24-rc1',
            '1.24',
            '1.23',
            '1.21.10',
        ]
        const sorted = sortVersions(versions)
        expect(sorted).toEqual([
            '1.7',
            '1.21',
            '1.21.10',
            '1.21.22',
            '1.23',
            '1.24-pre1',
            '1.24-pre4',
            '1.24-rc1',
            '1.24',
        ])
    })

    it('returns empty array when given empty input', () => {
        expect(sortVersions([])).toEqual([])
    })

    it('returns single item array unchanged', () => {
        expect(sortVersions(['1.10'])).toEqual(['1.10'])
    })

    it('prioritizes rc over pre', () => {
        expect(sortVersions(['1.20.1-rc1', '1.20-pre2', '1.20-rc1'])).toEqual(['1.20-pre2', '1.20-rc1', '1.20.1-rc1'])
    })

    it("counts up release candidate and prerelease versions", () => {
        expect(sortVersions(["1.20.1-pre1", "1.20.1-rc2", "1.20.1-pre2", "1.20.1-rc4", "1.20.1-rc3"])).toEqual(['1.20.1-pre1', '1.20.1-pre2', '1.20.1-rc2', '1.20.1-rc3', '1.20.1-rc4'])
    })
})