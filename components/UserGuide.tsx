import React from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, Shirt, Camera, Eraser, Film, Lightbulb, Edit3, History, 
  MousePointer2, Zap, Layers, Image as ImageIcon, CheckCircle2, 
  Info, HelpCircle, BookOpen, ArrowRight, PlayCircle, Settings
} from 'lucide-react';

const UserGuide: React.FC = () => {
  const sections = [
    {
      id: 'ai-generation',
      title: 'Tạo Ảnh (AI Generation)',
      icon: Sparkles,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      description: 'Biến ý tưởng thành hình ảnh chất lượng cao bằng sức mạnh của Gemini AI.',
      steps: [
        'Nhập mô tả (Prompt) chi tiết về hình ảnh bạn muốn tạo.',
        'Chọn Model: Gemini Flash (Nhanh) hoặc Gemini Pro (Chất lượng cao).',
        'Chọn tỷ lệ khung hình (1:1, 16:9, 9:16...) phù hợp với mục đích sử dụng.',
        'Sử dụng "Cài đặt nâng cao" để kiểm soát tối đa kết quả:',
        '  - Negative Prompt: Loại bỏ các yếu tố không mong muốn (ví dụ: "low quality, distorted hands, text").',
        '  - CFG Scale: Điều chỉnh mức độ AI bám sát prompt. Giá trị cao (10-15) giúp AI tuân thủ chặt chẽ, giá trị thấp (5-7) cho phép AI sáng tạo hơn.',
        '  - Seed: Cố định mã số ngẫu nhiên để giữ nguyên phong cách hoặc bố cục cho các lần tạo sau.',
        '  - Steps: Số bước lặp xử lý (nếu có). Càng nhiều bước, chi tiết càng rõ nét nhưng thời gian tạo sẽ lâu hơn.',
        'Nhấn "Tạo Ảnh" và sử dụng "Tối ưu AI" để nâng cấp prompt của bạn lên tầm chuyên nghiệp.'
      ],
      tips: 'Hãy mô tả cả bối cảnh, ánh sáng và phong cách nghệ thuật. Sử dụng Negative Prompt để loại bỏ lỗi, tăng CFG Scale để AI bám sát mô tả hơn, và cố định Seed để tái tạo phong cách ảnh.'
    },
    {
      id: 'virtual-tryon',
      title: 'Thay Đồ (Virtual Try-On)',
      icon: Shirt,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      description: 'Thử quần áo lên người mẫu thật một cách chân thực.',
      steps: [
        'Tải lên ảnh người mẫu (hoặc chọn từ thư viện).',
        'Tải lên ảnh sản phẩm quần áo bạn muốn thử.',
        'Chọn loại trang phục (Áo, Quần, hoặc Cả bộ).',
        'Nhấn "Bắt đầu thử đồ" để AI ghép trang phục vào người mẫu.',
        'Kết quả sẽ giữ nguyên tư thế và đặc điểm của người mẫu gốc.'
      ],
      tips: 'Ảnh người mẫu nên có phông nền đơn giản và tư thế đứng thẳng để đạt độ chính xác cao nhất.'
    },
    {
      id: 'refine-studio',
      title: 'Refine Studio (Chỉnh sửa chi tiết)',
      icon: Edit3,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      description: 'Thay đổi hoặc thêm bớt các chi tiết cụ thể trên ảnh bằng Generative Fill.',
      steps: [
        'Sử dụng công cụ Cọ vẽ (Brush) hoặc Lasso để chọn vùng bạn muốn thay đổi.',
        'Công cụ Lasso giúp bạn khoanh vùng chính xác bằng cách vẽ một đường khép kín.',
        'Sử dụng "Invert Mask" để đảo ngược vùng chọn nếu bạn muốn thay đổi mọi thứ trừ vùng đã tô.',
        'Điều chỉnh "Độ mềm" (Softness) để vùng biên được hòa trộn tự nhiên.',
        'Nhập mô tả cho vùng đã chọn (ví dụ: "thêm kính râm", "đổi thành áo sơ mi lụa").',
        'Tải lên "Ảnh tham chiếu" nếu bạn muốn AI mô phỏng theo một mẫu cụ thể.',
        'Nhấn "Tối ưu AI" để thực hiện thay đổi.'
      ],
      tips: 'Sử dụng phím tắt [B] để chọn cọ, [L] để chọn Lasso, [E] để tẩy, và giữ [Space] để di chuyển ảnh khi đang zoom.'
    },
    {
      id: 'multi-angle',
      title: 'Đa Góc (Multi-Angle Studio)',
      icon: Camera,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      description: 'Tạo ra các góc nhìn khác nhau của cùng một sản phẩm hoặc người mẫu.',
      steps: [
        'Tải lên ảnh gốc của sản phẩm.',
        'Chọn góc nhìn mong muốn (Chính diện, Nghiêng 45 độ, Từ trên xuống...).',
        'AI sẽ phân tích cấu trúc vật thể và tạo ra hình ảnh ở góc độ mới.',
        'Giúp tiết kiệm chi phí chụp ảnh studio cho nhiều góc độ.'
      ],
      tips: 'Ảnh gốc nên rõ nét và đủ ánh sáng để AI nhận diện khối vật thể tốt hơn.'
    },
    {
      id: 'background-remover',
      title: 'Tách Nền Pro (Background Remover)',
      icon: Eraser,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      description: 'Xóa phông nền tự động và thay thế hậu cảnh chuyên nghiệp.',
      steps: [
        'Tải ảnh lên hoặc kéo thả vào vùng làm việc.',
        'Hệ thống tự động nhận diện chủ thể và tạo ảnh PNG trong suốt.',
        'Sử dụng "Tinh chỉnh thủ công" (Refine) để sửa các chi tiết thừa bằng Cọ/Tẩy.',
        'Điều chỉnh "Độ mềm biên" (Feathering) để chủ thể hòa quyện tự nhiên hơn.',
        'Thêm "Đổ bóng thông minh" (Smart Shadow) để tăng độ chân thực.',
        'Chọn hậu cảnh mới: Màu sắc, Thư viện Studio, hoặc tải ảnh của riêng bạn.',
        'Hỗ trợ xử lý hàng loạt (Batch Processing) để tiết kiệm thời gian.'
      ],
      tips: 'Sử dụng công cụ Tẩy trong phần Tinh chỉnh để xóa các vùng AI còn sót lại ở kẽ tóc hoặc chi tiết nhỏ. Thêm một chút Feathering (2-5px) sẽ giúp ảnh ghép trông thật hơn rất nhiều.'
    },
    {
      id: 'photo-editor',
      title: 'Hậu Kỳ (Photo Editor)',
      icon: Settings,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      description: 'Tinh chỉnh ánh sáng, màu sắc và bố cục sau khi AI đã tạo ảnh.',
      steps: [
        'Nhấn vào biểu tượng Sliders (Chỉnh sửa chi tiết) trên ảnh kết quả.',
        'Điều chỉnh Độ sáng, Tương phản, Độ bão hòa để ảnh hài hòa hơn.',
        'Sử dụng "Cân bằng màu (Hue)" để thay đổi tông màu chủ đạo của ảnh.',
        'Xoay hoặc lật ảnh để có bố cục ưng ý nhất.',
        'Nhấn "Áp dụng & Lưu" để lưu lại các thay đổi hậu kỳ.'
      ],
      tips: 'Hãy thử tăng nhẹ Độ tương phản và Độ bão hòa để ảnh trông sống động và chuyên nghiệp hơn.'
    },
    {
      id: 'video-generator',
      title: 'Tạo Video (AI Video)',
      icon: Film,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      description: 'Biến hình ảnh tĩnh thành video chuyển động mượt mà.',
      steps: [
        'Chọn một hình ảnh chất lượng cao làm gốc.',
        'Nhập mô tả chuyển động (ví dụ: "tóc bay trong gió", "xe đang chạy trên đường").',
        'Chọn thời lượng và độ phân giải video.',
        'Nhấn "Tạo Video" và đợi AI xử lý (quá trình này có thể mất vài phút).'
      ],
      tips: 'Mô tả chuyển động càng cụ thể, kết quả video càng ấn tượng.'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-12 pb-20">
        
        {/* Header */}
        <header className="text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex p-3 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-xl shadow-blue-500/20 mb-4"
          >
            <BookOpen className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 uppercase tracking-tighter">
            Hướng Dẫn Sử Dụng
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base font-medium">
            Chào mừng bạn đến với AI Creative Studio. Hãy khám phá cách sử dụng các công cụ AI mạnh mẽ nhất để nâng tầm quy trình sáng tạo của bạn.
          </p>
        </header>

        {/* Quick Stats/Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4 group hover:bg-white/10 transition-all">
            <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-white text-xs uppercase tracking-widest">Tốc độ</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Xử lý trong giây lát</p>
            </div>
          </div>
          <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4 group hover:bg-white/10 transition-all">
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-white text-xs uppercase tracking-widest">Đa năng</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Tất cả trong một</p>
            </div>
          </div>
          <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4 group hover:bg-white/10 transition-all">
            <div className="p-3 rounded-2xl bg-yellow-500/20 text-yellow-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-white text-xs uppercase tracking-widest">Chất lượng</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Chuẩn Studio chuyên nghiệp</p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-8">
          {sections.map((section, idx) => (
            <motion.section 
              key={section.id}
              initial={{ x: -20, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group relative overflow-hidden rounded-[2.5rem] bg-white/5 border border-white/10 p-8 md:p-10 hover:border-white/20 transition-all"
            >
              <div className={`absolute top-0 right-0 w-64 h-64 ${section.bg} rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-1000`} />
              
              <div className="relative z-10 flex flex-col lg:flex-row gap-10">
                <div className="lg:w-1/3 space-y-6">
                  <div className={`w-16 h-16 rounded-3xl ${section.bg} flex items-center justify-center ${section.color} shadow-lg shadow-black/20`}>
                    <section.icon className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{section.title}</h2>
                    <p className="text-slate-400 text-sm leading-relaxed font-medium">{section.description}</p>
                  </div>
                </div>

                <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <PlayCircle className="w-3 h-3" /> Các bước thực hiện
                    </h4>
                    <ul className="space-y-3">
                      {section.steps.map((step, sIdx) => (
                        <li key={sIdx} className="flex gap-3 text-sm text-slate-300 font-medium leading-snug">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black text-white">{sIdx + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {section.tips && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Lightbulb className="w-3 h-3" /> Mẹo chuyên gia
                      </h4>
                      <div className="p-5 rounded-3xl bg-yellow-500/5 border border-yellow-500/10 text-sm text-yellow-200/80 italic font-medium leading-relaxed">
                        "{section.tips}"
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        {/* Keyboard Shortcuts */}
        <section className="rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-black border border-white/10 p-8 md:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400">
              <Zap className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Phím Tắt Thông Minh</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { key: 'B', desc: 'Công cụ Cọ vẽ' },
              { key: 'L', desc: 'Công cụ Lasso' },
              { key: 'E', desc: 'Công cụ Tẩy' },
              { key: 'Space', desc: 'Giữ để di chuyển ảnh' },
              { key: 'Ctrl + Z', desc: 'Hoàn tác (Undo)' },
              { key: 'Ctrl + Y', desc: 'Làm lại (Redo)' },
              { key: '[ / ]', desc: 'Tăng/Giảm kích thước cọ' },
              { key: 'H', desc: 'Về vị trí trung tâm' },
              { key: 'Enter', desc: 'Xác nhận thay đổi' },
            ].map((shortcut, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-xs text-slate-400 font-bold uppercase">{shortcut.desc}</span>
                <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-[10px] font-black text-white shadow-sm">{shortcut.key}</kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Help */}
        <footer className="text-center py-10 space-y-6">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <p className="text-slate-500 text-sm font-medium">Bạn vẫn còn thắc mắc? Hãy liên hệ với đội ngũ hỗ trợ của chúng tôi.</p>
          <div className="flex justify-center gap-4">
            <a 
              href="https://www.gapowork.vn/banhka" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest hover:scale-105 transition-all active:scale-95 inline-flex items-center justify-center"
            >
              Liên hệ hỗ trợ
            </a>
            <button className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95">
              Cộng đồng người dùng
            </button>
          </div>
        </footer>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};

export default UserGuide;
