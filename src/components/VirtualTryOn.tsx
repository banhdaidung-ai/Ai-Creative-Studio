import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  geminiService,
  MODEL_OPTIONS,
  hasRealGeminiCredentials,
  normalizeClientModelId,
} from '../services/gemini';
import { ModelSelector } from './ModelSelector';
import { resizeImage, formatImageSrc } from '../utils/image';
import {
  generateImageViaFlow,
  isFlowBackendAvailable,
  isFlowModel,
  FLOW_MODEL_IDS,
  FLOW_TO_GEMINI_MAP,
  buildFlowUnavailableMessage,
} from '../services/flowService';
import { useProject } from '../contexts/ProjectContext';
import MaskDrawEditor from './MaskDrawEditor';
import AspectRatioSelector from './AspectRatioSelector';
import ElapsedTimer from './ElapsedTimer';
import {
  UserCircle,
  Shirt,
  Layers,
  X,
  Download,
  Columns,
  Eye,
  Zap,
  Loader2,
  PenTool,
  ChevronDown,
  Wand2,
  Settings2,
  ChevronUp,
  Box,
  Palette,
} from 'lucide-react';

interface VirtualTryOnProps {
  embedded?: boolean;
}

const VirtualTryOn: React.FC<VirtualTryOnProps> = ({ embedded = false }) => {
  const { addToHistory, addToWorkspace, workspaceAsset } = useProject();
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [topRef, setTopRef] = useState<string | null>(null);
  const [bottomRef, setBottomRef] = useState<string | null>(null);
  const [accessoryRef, setAccessoryRef] = useState<string | null>(null);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [showConfig, setShowConfig] = useState(true);

  // Brand Color & Fabric Lock
  const [colorLock, setColorLock] = useState(false);
  const [hexColor, setHexColor] = useState('#1e3a8a');
  const [fabricDesc, setFabricDesc] = useState('');

  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    return normalizeClientModelId(
      localStorage.getItem('last_selected_model') || FLOW_MODEL_IDS.IMAGE_NANO_BANANA_PRO
    );
  });
  const [imageSize, setImageSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('3:4');

  const comparisonRef = useRef<HTMLDivElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const topInputRef = useRef<HTMLInputElement>(null);
  const bottomInputRef = useRef<HTMLInputElement>(null);
  const accessoryInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File, type: 'model' | 'top' | 'bottom' | 'accessory') => {
    if (!file.type.startsWith('image/')) return;
    const base64 = await resizeImage(file, 1536, 'image/jpeg', 0.88);
    if (type === 'model') {
      setModelImage(base64);
      setResultImage(null);
    } else if (type === 'top') setTopRef(base64);
    else if (type === 'bottom') setBottomRef(base64);
    else if (type === 'accessory') setAccessoryRef(base64);
  };

  const handleTryOn = async () => {
    if (!modelImage || (!topRef && !bottomRef && !accessoryRef)) {
      setError('Vui lòng tải ảnh người mẫu và ít nhất một sản phẩm (Áo, Quần/Váy hoặc Phụ kiện).');
      return;
    }

    const isFlow = isFlowModel(selectedModelId);
    if (!isFlow) {
      const hasKey = await hasRealGeminiCredentials();
      if (!hasKey && MODEL_OPTIONS.find((m) => m.id === selectedModelId)?.tier === 'pro') {
        window.dispatchEvent(new CustomEvent('open_unlock_modal', { detail: { tab: 'google' } }));
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    if (window.innerWidth < 1024) setShowConfig(false);

    const outfitDesc: string[] = [];
    const refs: string[] = [];
    if (topRef) {
      outfitDesc.push('the top/shirt/jacket garment from the product reference');
      refs.push(topRef);
    }
    if (bottomRef) {
      outfitDesc.push('the trousers/skirt/bottom garment from the product reference');
      refs.push(bottomRef);
    }
    if (accessoryRef) {
      outfitDesc.push('the shoes/bag/accessory from the product reference');
      refs.push(accessoryRef);
    }

    let prompt = `Full-outfit virtual fashion try-on: Dress the model in ${outfitDesc.join(', ')}.
    REQUIREMENTS:
    1. Perfect Fit & Drape: Natural folds, seams, and silhouette tailored cleanly to the model's pose.
    2. Seamless Edge Integration: Zero halo or cutout artifacts; realistic shadows on skin and clothes.
    3. Identity Preservation: Keep 100% identical face, hair, skin tone, and background.`;

    if (colorLock) {
      prompt += `\n4. STRICT COLOR & FABRIC LOCK: Preserve exact garment color HEX ${hexColor}${fabricDesc.trim() ? ` and exact fabric weave "${fabricDesc.trim()}"` : ''}.`;
    }

    if (maskImage) {
      refs.push(maskImage);
      prompt += `\n\nCRITICAL MASK INSTRUCTION: Modify ONLY areas marked white in the inpainting mask.`;
    }

    try {
      let result: string | null | undefined = null;

      if (isFlow) {
        const flowReady = await isFlowBackendAvailable().catch(() => false);
        if (flowReady) {
          toast.info('Đang phối bộ trang phục qua Google Flow...');
          const flowResult = await generateImageViaFlow({
            prompt,
            aspectRatio,
            numImages: 1,
            model: selectedModelId,
            modelImageBase64: modelImage,
            modelImageMime: modelImage.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg',
            referenceImagesBase64: refs,
            referenceImageBase64: refs[0],
            referenceImageMime: 'image/jpeg',
          });
          if (flowResult) {
            result = flowResult.startsWith('data:') ? flowResult.split(',')[1] : flowResult;
          }
        } else if (await hasRealGeminiCredentials()) {
          const fallbackModel = FLOW_TO_GEMINI_MAP[selectedModelId] || 'gemini-nano-banana-2.1';
          toast.info(`Google Flow chưa kết nối, tự động dùng ${fallbackModel}...`);
          result = await geminiService.editImage(modelImage, prompt, refs, {
            modelId: fallbackModel,
            aspectRatio,
            imageSize,
          });
        } else {
          window.dispatchEvent(new CustomEvent('open_unlock_modal', { detail: { tab: 'flow' } }));
          throw new Error(buildFlowUnavailableMessage().replace('FLOW_BACKEND_UNAVAILABLE: ', ''));
        }
      } else {
        result = await geminiService.editImage(modelImage, prompt, refs, {
          modelId: selectedModelId,
          aspectRatio,
          imageSize,
        });
      }

      if (result) {
        setResultImage(result);
        addToHistory({
          url: formatImageSrc(result),
          prompt,
          mode: 'BATCH_FASHION',
        });
        toast.success('Đã phối bộ trang phục thành công!');
      } else {
        throw new Error('Không nhận được kết quả từ AI.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi thực hiện ướm thử.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!comparisonRef.current) return;
    const rect = comparisonRef.current.getBoundingClientRect();
    const xPos = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    setSliderPosition(Math.max(0, Math.min(100, (xPos / rect.width) * 100)));
  };

  const Dropzone = ({ label, icon: Icon, image, onClear, onClick, sublabel }: any) => (
    <div className="space-y-1 flex-1">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block">{label}</span>
      <div
        onClick={onClick}
        className={`group relative h-24 md:h-28 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${
          image
            ? 'border-indigo-400/50 bg-indigo-500/5'
            : 'border-slate-300 dark:border-white/10 hover:border-indigo-400/50 hover:bg-white/5'
        }`}
      >
        {image ? (
          <>
            <img src={formatImageSrc(image)} className="w-full h-full object-contain p-1.5" alt={label} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="text-center p-2">
            <Icon className="w-5 h-5 text-slate-400 mx-auto mb-1 opacity-50 group-hover:scale-110 transition-transform" />
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-tight">{sublabel || 'Tải ảnh'}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`h-full w-full flex flex-col ${embedded ? '' : 'p-2 md:p-4'} overflow-hidden`}>
      {!embedded && (
        <div className="mb-3 flex items-center gap-3 shrink-0">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg">
            <UserCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none">Phối Bộ Ướm Thử AI</h2>
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 block mt-1">
              Mix & Match Full Outfit: Người mẫu + Áo + Quần/Váy + Phụ kiện
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
        <div className="w-full lg:w-[340px] flex flex-col gap-3 shrink-0 order-2 lg:order-1 overflow-hidden">
          <div className="bg-white/95 dark:bg-[#0f1115]/95 p-4 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col gap-3 flex-1 overflow-hidden">
            <div className="flex items-center justify-between lg:hidden p-1" onClick={() => setShowConfig(!showConfig)}>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <Settings2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Cấu hình Phối Bộ</span>
              </div>
              {showConfig ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {showConfig && (
              <div className="flex flex-col gap-3 overflow-y-auto no-scrollbar flex-1 pr-0.5">
                <ModelSelector
                  selectedModelId={selectedModelId}
                  onModelSelect={(id) => {
                    setSelectedModelId(id);
                    localStorage.setItem('last_selected_model', id);
                  }}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block">Độ nét</span>
                    <div className="flex bg-black/10 dark:bg-black/30 p-1 rounded-xl">
                      {['1K', '2K', '4K'].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setImageSize(size)}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                            imageSize === size ? 'bg-indigo-600 text-white' : 'text-slate-500'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} hasImage={!!modelImage} />
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
                      1. Người Mẫu Toàn Thân
                    </span>
                    {workspaceAsset && workspaceAsset.type !== 'video' && (
                      <button
                        type="button"
                        onClick={() =>
                          setModelImage(
                            workspaceAsset.url.includes(',') ? workspaceAsset.url.split(',')[1] : workspaceAsset.url
                          )
                        }
                        className="text-[8px] font-black text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Box size={10} /> Workspace
                      </button>
                    )}
                  </div>
                  <Dropzone
                    label=""
                    icon={UserCircle}
                    image={modelImage}
                    onClear={() => {
                      setModelImage(null);
                      setMaskImage(null);
                    }}
                    onClick={() => modelInputRef.current?.click()}
                    sublabel="Ảnh toàn thân"
                  />
                  {modelImage && (
                    <button
                      type="button"
                      onClick={() => setShowMaskEditor(true)}
                      className={`absolute bottom-2 right-2 px-2 py-1 rounded-lg text-[8px] font-bold flex items-center gap-1 shadow-md ${
                        maskImage ? 'bg-indigo-600 text-white' : 'bg-black/70 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      <PenTool className="w-3 h-3" />
                      {maskImage ? 'Đã có Mask' : 'Vẽ Mask'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Dropzone
                    label="2. Áo (Top)"
                    icon={Shirt}
                    image={topRef}
                    onClear={() => setTopRef(null)}
                    onClick={() => topInputRef.current?.click()}
                    sublabel="Áo / Khoác"
                  />
                  <Dropzone
                    label="3. Quần / Váy"
                    icon={Layers}
                    image={bottomRef}
                    onClear={() => setBottomRef(null)}
                    onClick={() => bottomInputRef.current?.click()}
                    sublabel="Quần / Chân váy"
                  />
                  <Dropzone
                    label="4. Phụ kiện"
                    icon={Wand2}
                    image={accessoryRef}
                    onClear={() => setAccessoryRef(null)}
                    onClick={() => accessoryInputRef.current?.click()}
                    sublabel="Giày / Túi"
                  />
                </div>

                {/* Color & Fabric Lock */}
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="vto-color-lock" className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        id="vto-color-lock"
                        type="checkbox"
                        checked={colorLock}
                        onChange={(e) => setColorLock(e.target.checked)}
                        className="w-3.5 h-3.5 accent-indigo-600 rounded"
                      />
                      <Palette size={11} className="text-indigo-400" />
                      Khóa mã màu & chất vải
                    </label>
                  </div>
                  {colorLock && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={hexColor}
                        onChange={(e) => setHexColor(e.target.value)}
                        className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={fabricDesc}
                        onChange={(e) => setFabricDesc(e.target.value)}
                        placeholder="Chất vải (VD: Denim, Lụa...)"
                        className="flex-1 px-2.5 py-1 rounded-lg bg-black/20 border border-white/10 text-[10px] text-white outline-none"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTryOn}
                  disabled={isLoading || !modelImage || (!topRef && !bottomRef && !accessoryRef)}
                  className="w-full py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[10px] shadow-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                  <span>
                    {isLoading ? (
                      <>
                        Đang phối đồ (<ElapsedTimer active={isLoading} />)...
                      </>
                    ) : (
                      'Phối Bộ Ngay'
                    )}
                  </span>
                </button>

                {error && (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-400">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 flex flex-col overflow-hidden order-1 lg:order-2">
          <div className="flex-1 bg-black/25 rounded-[2rem] relative overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center p-4 min-h-[280px]">
            {!resultImage && !isLoading && (
              <div className="text-center opacity-40">
                <Shirt className="w-14 h-14 mx-auto mb-3 text-indigo-400" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Phòng thử đồ phối nguyên cây (Áo + Quần/Váy + Phụ kiện)
                </p>
              </div>
            )}

            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md z-20">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
                <p className="text-indigo-400 font-black uppercase tracking-[0.25em] text-xs animate-pulse">
                  AI Fitting Room...
                </p>
              </div>
            )}

            {resultImage && (
              <div className="relative w-full h-full flex items-center justify-center">
                {isComparing && modelImage ? (
                  <div
                    ref={comparisonRef}
                    className="relative w-full h-full max-h-[82vh] rounded-2xl overflow-hidden cursor-col-resize select-none"
                    onMouseMove={handleSliderMove}
                    onTouchMove={handleSliderMove}
                  >
                    <img src={formatImageSrc(resultImage)} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="Sau phối đồ" />
                    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                      <img src={formatImageSrc(modelImage)} className="absolute inset-0 w-full h-full object-contain" alt="Trước phối đồ" />
                    </div>
                    <div className="absolute inset-y-0 w-0.5 bg-white shadow z-20 pointer-events-none" style={{ left: `${sliderPosition}%` }} />
                  </div>
                ) : (
                  <img
                    src={formatImageSrc(resultImage)}
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10"
                    alt="Kết quả phối bộ"
                  />
                )}

                <div className="absolute bottom-4 flex flex-wrap gap-2 z-30">
                  {modelImage && (
                    <button
                      type="button"
                      onClick={() => setIsComparing(!isComparing)}
                      className="px-3.5 py-2 bg-black/70 backdrop-blur-md rounded-xl text-white font-black text-[9px] uppercase tracking-widest border border-white/10 flex items-center gap-1.5"
                    >
                      {isComparing ? <Eye className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5" />}
                      <span>{isComparing ? 'Xem ảnh' : 'So sánh'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      addToWorkspace({
                        url: formatImageSrc(resultImage),
                        prompt: 'Full Outfit Virtual Try-On',
                        mode: 'BATCH_FASHION',
                      })
                    }
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 rounded-xl text-white font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <Box className="w-3.5 h-3.5" /> Workspace
                  </button>
                  <a
                    href={formatImageSrc(resultImage)}
                    download={`yody-outfit-mix-${Date.now()}.png`}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-black text-[9px] uppercase tracking-widest shadow-lg flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải xuống
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <input type="file" ref={modelInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'model')} accept="image/*" className="hidden" />
      <input type="file" ref={topInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'top')} accept="image/*" className="hidden" />
      <input type="file" ref={bottomInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'bottom')} accept="image/*" className="hidden" />
      <input type="file" ref={accessoryInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'accessory')} accept="image/*" className="hidden" />

      {showMaskEditor && modelImage && (
        <MaskDrawEditor
          imageSrc={modelImage}
          onSave={(maskStr) => {
            setMaskImage(maskStr);
            setShowMaskEditor(false);
          }}
          onCancel={() => setShowMaskEditor(false)}
        />
      )}
    </div>
  );
};

export default VirtualTryOn;
