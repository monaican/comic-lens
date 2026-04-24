import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig'
import { showToast } from './Toast'
import type { AppConfig, ModelConfig } from '../types'

function ModelConfigCard({ label, value, onChange }: {
  label: string
  value: ModelConfig
  onChange: (v: ModelConfig) => void
}) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="card bg-base-200 p-4 space-y-2">
      <h4 className="font-medium text-sm">{label}</h4>
      <div className="grid grid-cols-2 gap-2">
        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">Provider</span></label>
          <select className="select select-bordered select-sm" value={value.provider}
            onChange={e => onChange({ ...value, provider: e.target.value })}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">Model</span></label>
          <input className="input input-bordered input-sm" value={value.model}
            onChange={e => onChange({ ...value, model: e.target.value })} />
        </div>
      </div>
      <div className="form-control">
        <label className="label py-0.5"><span className="label-text text-xs">Base URL</span></label>
        <input className="input input-bordered input-sm" value={value.base_url}
          onChange={e => onChange({ ...value, base_url: e.target.value })} />
      </div>
      <div className="form-control">
        <label className="label py-0.5"><span className="label-text text-xs">API Key</span></label>
        <div className="flex gap-1">
          <input className="input input-bordered input-sm flex-1"
            type={showKey ? 'text' : 'password'} value={value.api_key}
            onChange={e => onChange({ ...value, api_key: e.target.value })} />
          <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(!showKey)}>
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { config, saveConfig } = useConfig()
  const [draft, setDraft] = useState<AppConfig | null>(null)

  useEffect(() => { if (config) setDraft({ ...config }) }, [config])

  if (!draft) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner" /></div>

  const handleSave = async () => {
    await saveConfig(draft)
    showToast('设置已保存')
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto">
      <h2 className="text-lg font-bold">设置</h2>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-base-content/60">模型配置</h3>
        <ModelConfigCard label="视觉模型" value={draft.vision_model}
          onChange={v => setDraft({ ...draft, vision_model: v })} />
        <ModelConfigCard label="推理模型" value={draft.reasoning_model}
          onChange={v => setDraft({ ...draft, reasoning_model: v })} />
        <ModelConfigCard label="图片生成模型" value={draft.image_gen}
          onChange={v => setDraft({ ...draft, image_gen: v })} />
      </div>

      <div className="card bg-base-200 p-4 space-y-2">
        <h3 className="text-sm font-medium">通用设置</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">并发数</span></label>
            <input type="number" className="input input-bordered input-sm" min={1} max={20}
              value={draft.concurrency} onChange={e => setDraft({ ...draft, concurrency: Number(e.target.value) })} />
          </div>
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">最大重试</span></label>
            <input type="number" className="input input-bordered input-sm" min={0} max={10}
              value={draft.max_retries} onChange={e => setDraft({ ...draft, max_retries: Number(e.target.value) })} />
          </div>
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">默认源语言</span></label>
            <input className="input input-bordered input-sm" value={draft.default_source_lang}
              onChange={e => setDraft({ ...draft, default_source_lang: e.target.value })} />
          </div>
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">默认目标语言</span></label>
            <input className="input input-bordered input-sm" value={draft.default_target_lang}
              onChange={e => setDraft({ ...draft, default_target_lang: e.target.value })} />
          </div>
        </div>
        <div className="form-control">
          <label className="label py-0.5"><span className="label-text text-xs">输出目录</span></label>
          <input className="input input-bordered input-sm" value={draft.output_base_dir}
            onChange={e => setDraft({ ...draft, output_base_dir: e.target.value })} />
        </div>
      </div>

      <div className="card bg-base-200 p-4 space-y-3">
        <h3 className="text-sm font-medium">提示词</h3>
        {([
          { key: 'vision_prompt' as const, label: '视觉提示词' },
          { key: 'global_analysis_prompt' as const, label: '全局分析提示词' },
          { key: 'page_translate_prompt' as const, label: '逐页翻译提示词' },
          { key: 'image_gen_prompt' as const, label: '图片生成提示词' }
        ]).map(({ key, label }) => (
          <div key={key} className="form-control">
            <div className="flex items-center justify-between">
              <label className="label py-0.5"><span className="label-text text-xs">{label}</span></label>
              <button className="btn btn-ghost btn-xs" onClick={() => setDraft({ ...draft, [key]: '' })}>重置默认</button>
            </div>
            <textarea
              className="textarea textarea-bordered text-xs font-mono h-24"
              value={draft[key]}
              onChange={e => setDraft({ ...draft, [key]: e.target.value })}
              placeholder="留空使用默认提示词"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end pb-4">
        <button className="btn btn-primary" onClick={handleSave}>保存设置</button>
      </div>
    </div>
  )
}
