import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig'
import { showToast } from './Toast'
import { Eye, EyeOff, RotateCcw, Save, Info } from 'lucide-react'
import AboutModal from './AboutModal'
import type { AppConfig, ModelConfig } from '../types'

function ModelConfigCard({ label, value, onChange, providerOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' }
] }: {
  label: string
  value: ModelConfig
  onChange: (v: ModelConfig) => void
  providerOptions?: Array<{ value: string; label: string }>
}) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="card card-bordered bg-base-100 shadow-sm">
      <div className="card-body p-4 gap-3">
        <h4 className="card-title text-sm">{label}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label"><span className="label-text text-xs">Provider</span></label>
            <select className="select select-bordered select-sm w-full" value={value.provider}
              onChange={e => onChange({ ...value, provider: e.target.value })}>
              {providerOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text text-xs">Model</span></label>
            <input className="input input-bordered input-sm w-full" value={value.model}
              onChange={e => onChange({ ...value, model: e.target.value })} />
          </div>
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text text-xs">Base URL</span></label>
          <input className="input input-bordered input-sm w-full" value={value.base_url}
            onChange={e => onChange({ ...value, base_url: e.target.value })} />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text text-xs">API Key</span></label>
          <div className="join w-full">
            <input className="input input-bordered input-sm join-item flex-1"
              type={showKey ? 'text' : 'password'} value={value.api_key}
              onChange={e => onChange({ ...value, api_key: e.target.value })} />
            <button className="btn btn-square btn-sm btn-outline join-item"
              onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SettingsProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
}

export default function Settings({ theme, onThemeChange }: SettingsProps) {
  const { config, saveConfig } = useConfig()
  const [draft, setDraft] = useState<AppConfig | null>(null)
  const [showAbout, setShowAbout] = useState(false)

  useEffect(() => {
    if (!config) return
    setDraft({
      ...config,
      image_gen: {
        ...config.image_gen,
        provider: 'openai'
      }
    })
  }, [config])

  if (!draft) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg text-primary" /></div>

  const handleSave = async () => {
    await saveConfig(draft)
    showToast('设置已保存')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">设置</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-content/60">主题</span>
              <select className="select select-bordered select-sm"
                value={theme} onChange={e => onThemeChange(e.target.value as 'light' | 'dark')}>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </div>
          </div>

          <div className="divider text-xs text-base-content/40 my-2">模型配置</div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ModelConfigCard label="视觉模型" value={draft.vision_model}
              onChange={v => setDraft({ ...draft, vision_model: v })} />
            <ModelConfigCard label="推理模型" value={draft.reasoning_model}
              onChange={v => setDraft({ ...draft, reasoning_model: v })} />
            <ModelConfigCard label="图片生成模型" value={draft.image_gen}
              providerOptions={[{ value: 'openai', label: 'OpenAI Responses' }]}
              onChange={v => setDraft({ ...draft, image_gen: v })} />
          </div>

          <div className="divider text-xs text-base-content/40 my-2">通用设置</div>

          <div className="card card-bordered bg-base-100 shadow-sm">
            <div className="card-body p-4 gap-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">并发数</span></label>
                  <input type="number" className="input input-bordered input-sm w-full" min={1} max={20}
                    value={draft.concurrency} onChange={e => setDraft({ ...draft, concurrency: Number(e.target.value) })} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">最大重试</span></label>
                  <input type="number" className="input input-bordered input-sm w-full" min={0} max={10}
                    value={draft.max_retries} onChange={e => setDraft({ ...draft, max_retries: Number(e.target.value) })} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">默认源语言</span></label>
                  <input className="input input-bordered input-sm w-full" value={draft.default_source_lang}
                    onChange={e => setDraft({ ...draft, default_source_lang: e.target.value })} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-xs">默认目标语言</span></label>
                  <input className="input input-bordered input-sm w-full" value={draft.default_target_lang}
                    onChange={e => setDraft({ ...draft, default_target_lang: e.target.value })} />
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">输出目录</span></label>
                <input className="input input-bordered input-sm w-full" value={draft.output_base_dir}
                  onChange={e => setDraft({ ...draft, output_base_dir: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="divider text-xs text-base-content/40 my-2">提示词</div>

          <div className="space-y-4">
            {([
              { key: 'vision_prompt' as const, label: '视觉提示词' },
              { key: 'global_analysis_prompt' as const, label: '全局分析提示词' },
              { key: 'page_translate_prompt' as const, label: '逐页翻译提示词' },
              { key: 'image_gen_prompt' as const, label: '图片生成提示词' }
            ]).map(({ key, label }) => (
              <div key={key} className="card card-bordered bg-base-100 shadow-sm">
                <div className="card-body p-4 gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{label}</span>
                    <button className="btn btn-outline btn-xs gap-1"
                      onClick={() => setDraft({ ...draft, [key]: '' })}>
                      <RotateCcw className="w-3 h-3" />重置默认
                    </button>
                  </div>
                  <textarea
                    className="textarea textarea-bordered text-xs font-mono min-h-24 resize-y w-full"
                    value={draft[key]}
                    onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                    placeholder="留空使用默认提示词"
                  />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div className="border-t border-base-300 bg-base-100 px-6 py-3 flex justify-between items-center">
        <button className="btn btn-ghost btn-sm gap-1" onClick={() => setShowAbout(true)}>
          <Info className="w-4 h-4" />关于
        </button>
        <button className="btn btn-primary btn-wide gap-2" onClick={handleSave}>
          <Save className="w-4 h-4" />保存设置
        </button>
      </div>
      <AboutModal open={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  )
}
