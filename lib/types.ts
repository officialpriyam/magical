import { TemplateId } from './templates'
import { ExecutionError, Result } from '@e2b/code-interpreter'
import { FileSystemNode } from '@/components/file-tree'

type ExecutionResultBase = {
  sbxId: string
  files?: FileSystemNode[]
}

export type ExecutionResultInterpreter = ExecutionResultBase & {
  template: 'code-interpreter-v1'
  stdout: string[]
  stderr: string[]
  runtimeError?: ExecutionError
  cellResults: Result[]
}

export type ExecutionResultWeb = ExecutionResultBase & {
  template: Exclude<TemplateId, 'code-interpreter-v1'>
  url: string
}

export type ExecutionResult = ExecutionResultInterpreter | ExecutionResultWeb