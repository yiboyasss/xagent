"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { JSONSyntaxHighlighter } from "@/components/ui/json-syntax-highlighter"
import { ChevronDown, ChevronRight, Clock, Bot, Wrench, Play, CheckCircle, XCircle, Info, Brain, Search, Sparkles } from "lucide-react"
import { MessagesPreview } from "./messages-preview"
import { useI18n } from "@/contexts/i18n-context"

interface TraceEvent {
  event_id: string
  event_type: string
  step_id?: string
  timestamp: string
  data: unknown
}

interface LogEventProps {
  event: TraceEvent
}

// Common log summary component
function LogSummary({ event }: LogEventProps) {
  const data = event.data as Record<string, any> || {}
  const action = data.action || event.event_type || null
  const stepName = data.step_name || data.name || ''
  const { t } = useI18n()

  // Select icon and color based on action type
  const getActionConfig = () => {
    const configs: Record<string, { icon: React.ReactNode, color: string, labelKey: string }> = {
      "步骤开始": { icon: <Play className="h-4 w-4" />, color: "text-blue-500", labelKey: "agent.logs.event.labels.start" },
      "步骤完成": { icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.completed" },
      "步骤失败": { icon: <XCircle className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.failed" },
      "LLM调用开始": { icon: <Bot className="h-4 w-4" />, color: "text-purple-500", labelKey: "agent.logs.event.labels.llmCall" },
      "LLM调用完成": { icon: <Bot className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.llmCompleted" },
      "LLM调用失败": { icon: <Bot className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.llmFailed" },
      "工具调用开始": { icon: <Wrench className="h-4 w-4" />, color: "text-orange-500", labelKey: "agent.logs.event.labels.toolCall" },
      "工具调用完成": { icon: <Wrench className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.toolCompleted" },
      "工具调用失败": { icon: <Wrench className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.toolFailed" },
      "记忆生成开始": { icon: <Brain className="h-4 w-4" />, color: "text-purple-500", labelKey: "agent.logs.event.labels.memoryGenerate" },
      "记忆生成完成": { icon: <Brain className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryGenerate" },
      "记忆存储开始": { icon: <Brain className="h-4 w-4" />, color: "text-orange-500", labelKey: "agent.logs.event.labels.memoryStore" },
      "记忆存储完成": { icon: <Brain className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryStore" },
      "记忆查询": { icon: <Search className="h-4 w-4" />, color: "text-blue-500", labelKey: "agent.logs.event.labels.memoryQuery" },
      "记忆查询完成": { icon: <Search className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryQuery" },
      "上下文压缩开始": { icon: <span className="text-lg">🗜️</span>, color: "text-blue-500", labelKey: "agent.logs.event.labels.compactStart" },
      "上下文压缩完成": { icon: <span className="text-lg">🗜️</span>, color: "text-green-500", labelKey: "agent.logs.event.labels.compactCompleted" },
      // English action strings (i18n-en)
      "Step Start": { icon: <Play className="h-4 w-4" />, color: "text-blue-500", labelKey: "agent.logs.event.labels.start" },
      "Step Completed": { icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.completed" },
      "Step Failed": { icon: <XCircle className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.failed" },
      "LLM Call Start": { icon: <Bot className="h-4 w-4" />, color: "text-purple-500", labelKey: "agent.logs.event.labels.llmCall" },
      "LLM Call Completed": { icon: <Bot className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.llmCompleted" },
      "LLM Call Failed": { icon: <Bot className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.llmFailed" },
      "Tool Call Start": { icon: <Wrench className="h-4 w-4" />, color: "text-orange-500", labelKey: "agent.logs.event.labels.toolCall" },
      "Tool Call Completed": { icon: <Wrench className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.toolCompleted" },
      "Tool Call Failed": { icon: <Wrench className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.toolFailed" },
      "Memory Generate Start": { icon: <Brain className="h-4 w-4" />, color: "text-purple-500", labelKey: "agent.logs.event.labels.memoryGenerate" },
      "Memory Generate Completed": { icon: <Brain className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryGenerate" },
      "Memory Store Start": { icon: <Brain className="h-4 w-4" />, color: "text-orange-500", labelKey: "agent.logs.event.labels.memoryStore" },
      "Memory Store Completed": { icon: <Brain className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryStore" },
      "Memory Query": { icon: <Search className="h-4 w-4" />, color: "text-blue-500", labelKey: "agent.logs.event.labels.memoryQuery" },
      "Memory Query Completed": { icon: <Search className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryQuery" },
      "Context Compact Start": { icon: <span className="text-lg">🗜️</span>, color: "text-blue-500", labelKey: "agent.logs.event.labels.compactStart" },
      "Context Compact Completed": { icon: <span className="text-lg">🗜️</span>, color: "text-green-500", labelKey: "agent.logs.event.labels.compactCompleted" },
      // Event type keys (stable codes)
      "dag_step_start": { icon: <Play className="h-4 w-4" />, color: "text-blue-500", labelKey: "agent.logs.event.labels.start" },
      "dag_step_end": { icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.completed" },
      "dag_step_failed": { icon: <XCircle className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.failed" },
      "llm_call_start": { icon: <Bot className="h-4 w-4" />, color: "text-purple-500", labelKey: "agent.logs.event.labels.llmCall" },
      "llm_call_end": { icon: <Bot className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.llmCompleted" },
      "llm_call_failed": { icon: <Bot className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.llmFailed" },
      "tool_execution_start": { icon: <Wrench className="h-4 w-4" />, color: "text-orange-500", labelKey: "agent.logs.event.labels.toolCall" },
      "tool_execution_end": { icon: <Wrench className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.toolCompleted" },
      "tool_execution_failed": { icon: <Wrench className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.toolFailed" },
      "task_start_memory_retrieve": { icon: <Search className="h-4 w-4" />, color: "text-blue-500", labelKey: "agent.logs.event.labels.memoryQuery" },
      "task_end_memory_retrieve": { icon: <Search className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryQuery" },
      "task_start_memory_generate": { icon: <Brain className="h-4 w-4" />, color: "text-purple-500", labelKey: "agent.logs.event.labels.memoryGenerate" },
      "task_end_memory_generate": { icon: <Brain className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryGenerate" },
      "task_start_memory_store": { icon: <Brain className="h-4 w-4" />, color: "text-orange-500", labelKey: "agent.logs.event.labels.memoryStore" },
      "task_end_memory_store": { icon: <Brain className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.memoryStore" },
      "action_start_compact": { icon: <span className="text-lg">🗜️</span>, color: "text-blue-500", labelKey: "agent.logs.event.labels.compactStart" },
      "action_end_compact": { icon: <span className="text-lg">🗜️</span>, color: "text-green-500", labelKey: "agent.logs.event.labels.compactCompleted" },
      "skill_select_start": { icon: <Sparkles className="h-4 w-4" />, color: "text-blue-500", labelKey: "agent.logs.event.labels.skillSelectStart" },
      "skill_select_end": { icon: <Sparkles className="h-4 w-4" />, color: "text-green-500", labelKey: "agent.logs.event.labels.skillSelectEnd" },
    }

    const config = configs[action]
    if (!config) {
      console.log('🔴🔴🔴 Unknown action 🔴🔴🔴', event)
      return { icon: <Info className="h-4 w-4" />, color: "text-red-500", labelKey: "agent.logs.event.labels.unknown" }
    }
    return config
  }

  const getActionText = (act: string) => {
    const map: Record<string, string> = {
      "步骤开始": "agent.logs.event.actions.stepStart",
      "步骤完成": "agent.logs.event.actions.stepCompleted",
      "步骤失败": "agent.logs.event.actions.stepFailed",
      "LLM调用开始": "agent.logs.event.actions.llmStart",
      "LLM调用完成": "agent.logs.event.actions.llmCompleted",
      "LLM调用失败": "agent.logs.event.actions.llmFailed",
      "工具调用开始": "agent.logs.event.actions.toolStart",
      "工具调用完成": "agent.logs.event.actions.toolCompleted",
      "工具调用失败": "agent.logs.event.actions.toolFailed",
      "记忆生成开始": "agent.logs.event.actions.memoryGenerateStart",
      "记忆生成完成": "agent.logs.event.actions.memoryGenerateCompleted",
      "记忆存储开始": "agent.logs.event.actions.memoryStoreStart",
      "记忆存储完成": "agent.logs.event.actions.memoryStoreCompleted",
      "记忆查询": "agent.logs.event.actions.memoryQuery",
      "记忆查询完成": "agent.logs.event.actions.memoryQueryCompleted",
      "上下文压缩开始": "agent.logs.event.actions.compactStart",
      "上下文压缩完成": "agent.logs.event.actions.compactCompleted",
      // English action strings (i18n-en)
      "Step Start": "agent.logs.event.actions.stepStart",
      "Step Completed": "agent.logs.event.actions.stepCompleted",
      "Step Failed": "agent.logs.event.actions.stepFailed",
      "LLM Call Start": "agent.logs.event.actions.llmStart",
      "LLM Call Completed": "agent.logs.event.actions.llmCompleted",
      "LLM Call Failed": "agent.logs.event.actions.llmFailed",
      "Tool Call Start": "agent.logs.event.actions.toolStart",
      "Tool Call Completed": "agent.logs.event.actions.toolCompleted",
      "Tool Call Failed": "agent.logs.event.actions.toolFailed",
      "Memory Generate Start": "agent.logs.event.actions.memoryGenerateStart",
      "Memory Generate Completed": "agent.logs.event.actions.memoryGenerateCompleted",
      "Memory Store Start": "agent.logs.event.actions.memoryStoreStart",
      "Memory Store Completed": "agent.logs.event.actions.memoryStoreCompleted",
      "Memory Query": "agent.logs.event.actions.memoryQuery",
      "Memory Query Completed": "agent.logs.event.actions.memoryQueryCompleted",
      "Context Compact Start": "agent.logs.event.actions.compactStart",
      "Context Compact Completed": "agent.logs.event.actions.compactCompleted",
      // Event type keys (stable codes)
      "dag_step_start": "agent.logs.event.actions.stepStart",
      "dag_step_end": "agent.logs.event.actions.stepCompleted",
      "dag_step_failed": "agent.logs.event.actions.stepFailed",
      "llm_call_start": "agent.logs.event.actions.llmStart",
      "llm_call_end": "agent.logs.event.actions.llmCompleted",
      "llm_call_failed": "agent.logs.event.actions.llmFailed",
      "tool_execution_start": "agent.logs.event.actions.toolStart",
      "tool_execution_end": "agent.logs.event.actions.toolCompleted",
      "tool_execution_failed": "agent.logs.event.actions.toolFailed",
      "task_start_memory_retrieve": "agent.logs.event.actions.memoryQuery",
      "task_end_memory_retrieve": "agent.logs.event.actions.memoryQueryCompleted",
      "task_start_memory_generate": "agent.logs.event.actions.memoryGenerateStart",
      "task_end_memory_generate": "agent.logs.event.actions.memoryGenerateCompleted",
      "task_start_memory_store": "agent.logs.event.actions.memoryStoreStart",
      "task_end_memory_store": "agent.logs.event.actions.memoryStoreCompleted",
      "action_start_compact": "agent.logs.event.actions.compactStart",
      "action_end_compact": "agent.logs.event.actions.compactCompleted",
      "skill_select_start": "agent.logs.event.actions.skillSelectStart",
      "skill_select_end": "agent.logs.event.actions.skillSelectEnd",
    }
    const key = map[act]
    return key ? t(key) : act
  }

  const config = getActionConfig()
  const { formatTime } = require('@/lib/time-utils')

  return (
    <div className="space-y-2">
      {/* Main information row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className="text-sm font-medium">{getActionText(action)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-muted-foreground/30">
            {t(config.labelKey)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatTime(event.timestamp)}
          </span>
        </div>
      </div>

      {/* Step name row (if any) */}
      {stepName && (
        <div className="flex items-center gap-2 pl-6">
          <span className="text-xs text-muted-foreground">{stepName}</span>
        </div>
      )}
    </div>
  )
}

// LLM call details component
function LLMCallDetails({ data }: { data: Record<string, any> }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {/* Basic information */}
      <div className="grid grid-cols-2 gap-3">
        {data.model_name && (
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.llm.model')}</span>
            <span className="text-sm font-mono">{data.model_name}</span>
          </div>
        )}
        {data.context_messages_count && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.llm.contextMessages')}</span>
            <span className="text-sm font-mono">{data.context_messages_count} {t('agent.logs.event.common.itemsSuffix')}</span>
          </div>
        )}
      </div>

      {/* Context preview */}
      {data.context_preview && (
        <MessagesPreview contextPreview={data.context_preview} />
      )}

      {/* Other important information */}
      {(data.temperature || data.max_tokens || data.top_p) && (
        <Card className="border-border">
          <div className="p-3">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              {t('agent.logs.event.llm.paramsTitle')}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {data.temperature && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('agent.logs.event.llm.temperature')}</span>
                  <span className="font-mono">{data.temperature}</span>
                </div>
              )}
              {data.max_tokens && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('agent.logs.event.llm.maxTokens')}</span>
                  <span className="font-mono">{data.max_tokens}</span>
                </div>
              )}
              {data.top_p && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('agent.logs.event.llm.topP')}</span>
                  <span className="font-mono">{data.top_p}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Full data */}
      <Card className="border-border">
        <div className="p-3">
          <h4 className="text-sm font-medium mb-2">{t('agent.logs.event.common.fullData')}</h4>
          <JSONSyntaxHighlighter data={data} />
        </div>
      </Card>
    </div>
  )
}

// Tool call details component
function ToolCallDetails({ data }: { data: Record<string, any> }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {/* Basic information */}
      <div className="grid grid-cols-2 gap-3">
        {data.tool_name && (
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.tool.tool')}</span>
            <span className="text-sm font-mono">{data.tool_name}</span>
          </div>
        )}
        {data.params_count && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.tool.paramsCount')}</span>
            <span className="text-sm font-mono">{data.params_count}</span>
          </div>
        )}
      </div>

      {/* Tool parameters */}
      {data.tool_params && (
        <Card className="border-border">
          <div className="p-3">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              {t('agent.logs.event.tool.paramsTitle')}
            </h4>
            <JSONSyntaxHighlighter data={data.tool_params} />
          </div>
        </Card>
      )}

      {/* Full data */}
      <Card className="border-border">
        <div className="p-3">
          <h4 className="text-sm font-medium mb-2">{t('agent.logs.event.common.fullData')}</h4>
          <JSONSyntaxHighlighter data={data} />
        </div>
      </Card>
    </div>
  )
}

// Context compression details component
function CompactDetails({ data }: { data: Record<string, any> }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {/* Basic information */}
      <div className="grid grid-cols-2 gap-3">
        {data.compact_type && (
          <div className="flex items-center gap-2">
            <span className="text-lg">🗜️</span>
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.compact.type')}</span>
            <span className="text-sm font-mono">
              {data.compact_type === "individual_dependency" ? t('agent.logs.event.compact.types.individual_dependency') :
               data.compact_type === "entire_context" ? t('agent.logs.event.compact.types.entire_context') :
               data.compact_type}
            </span>
          </div>
        )}
        {data.compact_model && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.compact.model')}</span>
            <span className="text-sm font-mono">{data.compact_model}</span>
          </div>
        )}
        {data.original_tokens && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.compact.originalTokens')}</span>
            <span className="text-sm font-mono">{data.original_tokens.toLocaleString()}</span>
          </div>
        )}
        {data.threshold && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.compact.threshold')}</span>
            <span className="text-sm font-mono">{data.threshold.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Compression result */}
      {data.compacted_tokens && (
        <Card className="border-border">
          <div className="p-3">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <span className="text-lg">🗜️</span>
              {t('agent.logs.event.compact.resultTitle')}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('agent.logs.event.compact.compactedTokens')}</span>
                <span className="font-mono">{data.compacted_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('agent.logs.event.compact.compressionRatio')}</span>
                <span className="font-mono text-green-600">{data.compression_ratio}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Error info */}
      {data.error && (
        <Card className="border-border border-red-200">
          <div className="p-3">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <span className="text-lg">❌</span>
              {t('agent.logs.event.compact.errorTitle')}
            </h4>
            <div className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded">
              {data.error}
            </div>
          </div>
        </Card>
      )}

      {/* Full data */}
      <Card className="border-border">
        <div className="p-3">
          <h4 className="text-sm font-medium mb-2">{t('agent.logs.event.common.fullData')}</h4>
          <JSONSyntaxHighlighter data={data} />
        </div>
      </Card>
    </div>
  )
}

// Memory query details component
function MemoryQueryDetails({ data }: { data: Record<string, any> }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {/* Basic information */}
      <div className="grid grid-cols-2 gap-3">
        {data.task && (
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.memory.task')}</span>
            <span className="text-sm font-mono">{data.task}</span>
          </div>
        )}
        {data.memory_category && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.memory.category')}</span>
            <span className="text-sm font-mono">{data.memory_category}</span>
          </div>
        )}
        {data.memories_found !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.memory.found')}</span>
            <span className="text-sm font-mono">{data.memories_found} {t('agent.logs.event.common.itemsSuffix')}</span>
          </div>
        )}
        {data.memories_used !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.memory.used')}</span>
            <span className="text-sm font-mono">{data.memories_used} {t('agent.logs.event.common.itemsSuffix')}</span>
          </div>
        )}
      </div>

      {/* Related memories */}
      {data.rawData?.memories && Array.isArray(data.rawData.memories) && data.rawData.memories.length > 0 && (
        <Card className="border-border">
          <div className="p-3">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              {t('agent.logs.event.memory.relatedTitle')}
            </h4>
            <div className="space-y-2">
              {data.rawData.memories.map((memory: any, index: number) => (
                <div key={index} className="text-xs p-2 bg-muted/20 rounded border border-border/50">
                  <div className="whitespace-pre-wrap">{memory.content || memory}</div>
                  {memory.category && (
                    <Badge variant="outline" className="text-xs mt-1">
                      {memory.category}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Full data */}
      <Card className="border-border">
        <div className="p-3">
          <h4 className="text-sm font-medium mb-2">{t('agent.logs.event.common.fullData')}</h4>
          <JSONSyntaxHighlighter data={data.rawData || data} />
        </div>
      </Card>
    </div>
  )
}

// Skill selection details component
function SkillSelectDetails({ data }: { data: Record<string, any> }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {/* Basic information */}
      <div className="grid grid-cols-1 gap-3">
        {data.task && (
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm text-muted-foreground">{t('agent.logs.event.skill.task')}</span>
              <p className="text-sm font-mono mt-1 break-all">{data.task}</p>
            </div>
          </div>
        )}
        {data.available_skills_count !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.skill.availableCount')}</span>
            <span className="text-sm font-mono">{data.available_skills_count}</span>
          </div>
        )}
        {data.selected !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.skill.selected')}</span>
            <Badge variant={data.selected ? "default" : "secondary"} className="text-xs">
              {data.selected ? t('agent.logs.event.skill.yes') : t('agent.logs.event.skill.no')}
            </Badge>
          </div>
        )}
        {data.skill_name && (
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">{t('agent.logs.event.skill.skillName')}</span>
            <Badge variant="outline" className="text-xs font-mono">
              {data.skill_name}
            </Badge>
          </div>
        )}
      </div>

      {/* Full data */}
      <Card className="border-border">
        <div className="p-3">
          <h4 className="text-sm font-medium mb-2">{t('agent.logs.event.common.fullData')}</h4>
          <JSONSyntaxHighlighter data={data} />
        </div>
      </Card>
    </div>
  )
}

// Common details component
function GenericDetails({ data }: { data: Record<string, any> }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {/* Key information */}
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(data).map(([key, value]) => {
          if (['action', 'step_name', 'timestamp'].includes(key)) return null

          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{key}:</span>
              <span className="text-sm font-mono">
                {typeof value === 'string' && value.length > 50
                  ? `${value.substring(0, 50)}...`
                  : String(value)
                }
              </span>
            </div>
          )
        })}
      </div>

      {/* Full data */}
      <Card className="border-border">
        <div className="p-3">
          <h4 className="text-sm font-medium mb-2">{t('agent.logs.event.common.fullData')}</h4>
          <JSONSyntaxHighlighter data={data} />
        </div>
      </Card>
    </div>
  )
}

// Main log event component
export function LogEvent({ event }: LogEventProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const data = event.data as Record<string, any> || {}
  const action = data.action || event.event_type || null

  // If unknown action, do not display
  if (!action) {
    return null
  }

  // Select details component based on action type
  const getDetailsComponent = () => {
    const type = event.event_type || ''
    const actLower = typeof action === 'string' ? action.toLowerCase() : ''

    if (actLower.includes('llm调用') || actLower.includes('llm') || type.includes('llm_call')) {
      return <LLMCallDetails data={data} />
    } else if (actLower.includes('工具调用') || actLower.includes('tool') || type.includes('tool_execution')) {
      return <ToolCallDetails data={data} />
    } else if (actLower.includes('上下文压缩') || actLower.includes('compact') || type.includes('compact')) {
      return <CompactDetails data={data} />
    } else if (actLower.includes('记忆查询') || actLower.includes('memory query') || type.includes('memory_retrieve')) {
      return <MemoryQueryDetails data={data} />
    } else if (actLower.includes('skill') || type.includes('skill_select')) {
      return <SkillSelectDetails data={data} />
    } else {
      return <GenericDetails data={data} />
    }
  }


  return (
    <Card className="bg-card/50 border-border hover:shadow-md transition-shadow">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <LogSummary event={event} />
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 border-t border-border">
            {getDetailsComponent()}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
