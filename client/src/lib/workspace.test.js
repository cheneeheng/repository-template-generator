import { describe, it, expect, beforeEach } from 'vitest'
import { loadWorkspace, saveEntry, deleteEntry } from './workspace.js'

beforeEach(() => {
  localStorage.clear()
})

describe('loadWorkspace', () => {
  it('returns empty array when localStorage is empty', () => {
    expect(loadWorkspace()).toEqual([])
  })

  it('returns empty array on corrupt JSON', () => {
    localStorage.setItem('ftg:workspace', 'not-json{{{')
    expect(loadWorkspace()).toEqual([])
  })
})

describe('saveEntry', () => {
  it('persists entry and loads it back', () => {
    const entry = { id: 'abc', projectName: 'app', templateId: 't1', fileTree: [], snapshots: [], savedAt: 1000 }
    saveEntry(entry)
    expect(loadWorkspace()).toEqual([entry])
  })

  it('updates existing entry by id without duplicating', () => {
    const entry = { id: 'abc', projectName: 'app', templateId: 't1', fileTree: [], snapshots: [], savedAt: 1000 }
    saveEntry(entry)
    const updated = { ...entry, savedAt: 2000 }
    saveEntry(updated)
    const list = loadWorkspace()
    expect(list).toHaveLength(1)
    expect(list[0].savedAt).toBe(2000)
  })

  it('drops oldest entry when list exceeds 20', () => {
    for (let i = 0; i < 20; i++) {
      saveEntry({ id: `id-${i}`, projectName: `p${i}`, templateId: 't', fileTree: [], snapshots: [], savedAt: i })
    }
    expect(loadWorkspace()).toHaveLength(20)
    saveEntry({ id: 'new', projectName: 'new', templateId: 't', fileTree: [], snapshots: [], savedAt: 99 })
    const list = loadWorkspace()
    expect(list).toHaveLength(20)
    expect(list[0].id).toBe('new')
    // oldest (id-0) dropped
    expect(list.find(e => e.id === 'id-0')).toBeUndefined()
  })
})

describe('deleteEntry', () => {
  it('removes entry by id', () => {
    saveEntry({ id: 'x', projectName: 'app', templateId: 't', fileTree: [], snapshots: [], savedAt: 1 })
    saveEntry({ id: 'y', projectName: 'app2', templateId: 't', fileTree: [], snapshots: [], savedAt: 2 })
    deleteEntry('x')
    const list = loadWorkspace()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('y')
  })
})
