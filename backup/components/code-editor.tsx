import Editor, { Monaco } from '@monaco-editor/react'
import { useEffect, useRef } from 'react'
import * as monacoEditor from 'monaco-editor'
import { useTheme } from 'next-themes'
// @ts-ignore
import './code-theme.css'

export function CodeEditor({
  code,
  lang,
  onChange,
  onBlur,
  onSave,
}: {
  code: string
  lang: string
  onChange: (value: string | undefined) => void
  onBlur?: (value: string) => void
  onSave?: (value: string) => void
}) {
  const { theme } = useTheme()
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(
    null,
  )
  const onChangeRef = useRef(onChange)
  const onBlurRef = useRef(onBlur)
  const onSaveRef = useRef(onSave)

  useEffect(() => {
    onChangeRef.current = onChange
    onBlurRef.current = onBlur
    onSaveRef.current = onSave
  }, [onBlur, onChange, onSave])

  function handleEditorDidMount(
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) {
    editorRef.current = editor

    // Quick save shortcut (Ctrl/Cmd + S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentCode = editor.getValue()
      onSaveRef.current?.(currentCode)
    })
    
    // Find and replace (Ctrl/Cmd + H) - Monaco has this built-in but let's ensure it's enabled
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      editor.trigger('', 'editor.action.startFindReplaceAction', {})
    })
    
    // Format document (Alt + Shift + F)
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      editor.trigger('', 'editor.action.formatDocument', {})
    })

    editor.onDidBlurEditorText(() => {
      onBlurRef.current?.(editor.getValue())
    })
  }

  return (
    <Editor
      height="100%"
        language={lang}
        defaultValue={code}
        onChange={(value) => onChangeRef.current(value)}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onMount={handleEditorDidMount}
        options={{
          minimap: {
            enabled: false,
          },
          fontSize: 14,
          fontFamily: 'JetBrains Mono, SF Mono, Monaco, Inconsolata, Fira Code, Droid Sans Mono, Consolas, monospace',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: true,
          renderWhitespace: 'selection',
          bracketPairColorization: {
            enabled: true,
          },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          quickSuggestions: {
            other: true,
            comments: true,
            strings: true,
          },
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'mouseover',
          lineNumbers: 'on',
          glyphMargin: false,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          smoothScrolling: false,
          // Enable find widget
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'always',
          },
        }}
      />
  )
}
