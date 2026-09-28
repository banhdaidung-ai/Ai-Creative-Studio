import { PromptTemplate } from '../types';

export const STARTER_PROMPTS: PromptTemplate[] = [
  // STUDIO CATEGORY
  {
    id: 'studio-1',
    title: 'Studio High-Key Fashion',
    category: 'Studio',
    style: 'Photorealistic',
    lighting: 'High-Key',
    prompt: 'Professional fashion photography of a model wearing a minimalist white linen shirt and beige trousers, standing in a bright high-key studio, soft diffused lighting, clean white background, 8k resolution, highly detailed skin texture, cinematic composition.',
    negativePrompt: 'blurry, low quality, distorted, messy background, dark shadows, oversaturated',
    imageUrl: 'https://picsum.photos/seed/studio-highkey/800/1200',
    tags: ['Minimalist', 'Studio', 'Clean', 'Linen'],
    aspectRatio: '3:4'
  },
  {
    id: 'studio-2',
    title: 'Cinematic Low-Key Portrait',
    category: 'Studio',
    style: 'Cinematic',
    lighting: 'Low-Key',
    prompt: 'Dramatic low-key fashion portrait, model in a black velvet dress, single light source creating sharp highlights and deep shadows, moody atmosphere, high contrast, fine art photography style, deep blacks, rich textures.',
    negativePrompt: 'bright, flat lighting, noisy, low contrast, washed out',
    imageUrl: 'https://picsum.photos/seed/studio-lowkey/800/1200',
    tags: ['Dramatic', 'Portrait', 'Velvet', 'Moody'],
    aspectRatio: '3:4'
  },
  {
    id: 'studio-3',
    title: 'Soft Box Beauty Shot',
    category: 'Studio',
    style: 'Beauty',
    lighting: 'Soft Box',
    prompt: 'Close-up beauty photography, flawless skin, elegant makeup, soft box lighting from the side, pastel background, ethereal glow, high-end commercial style, sharp focus on eyes, 8k resolution.',
    negativePrompt: 'harsh shadows, skin blemishes, blurry, low res, messy hair',
    imageUrl: 'https://picsum.photos/seed/beauty-soft/800/1200',
    tags: ['Beauty', 'Makeup', 'Ethereal', 'Commercial'],
    aspectRatio: '4:5'
  },
  {
    id: 'studio-4',
    title: 'Editorial Avant-Garde',
    category: 'Studio',
    style: 'Avant-Garde',
    lighting: 'Strobe',
    prompt: 'Avant-garde fashion editorial, model in structured metallic outfit, dynamic pose, sharp strobe lighting with colored gels (cyan and magenta), abstract shadows, high-fashion magazine style, bold composition.',
    negativePrompt: 'casual, simple, natural lighting, boring, standard',
    imageUrl: 'https://picsum.photos/seed/avant-garde/800/1200',
    tags: ['Avant-Garde', 'Metallic', 'Editorial', 'Strobe'],
    aspectRatio: '2:3'
  },

  // STREETWEAR CATEGORY
  {
    id: 'street-1',
    title: 'Parisian Street Style',
    category: 'Streetwear',
    style: 'Street Photography',
    lighting: 'Golden Hour',
    prompt: 'Street style photography of a trendy woman walking on a cobblestone street in Paris, wearing a chic oversized blazer and denim, Eiffel Tower blurred in the background, golden hour lighting, natural cinematic look, 35mm lens effect.',
    negativePrompt: 'cartoon, drawing, anime, low res, bad anatomy, extra limbs',
    imageUrl: 'https://picsum.photos/seed/paris-street/800/1200',
    tags: ['Paris', 'Streetwear', 'Golden Hour', 'Chic'],
    aspectRatio: '3:4'
  },
  {
    id: 'street-2',
    title: 'Tokyo Neon Techwear',
    category: 'Streetwear',
    style: 'Cyberpunk',
    lighting: 'Neon',
    prompt: 'Futuristic techwear fashion, model wearing a sleek black waterproof jacket with neon blue accents, standing in a rainy Tokyo alleyway at night, vibrant neon signs reflecting in puddles, cinematic lighting, volumetric fog.',
    negativePrompt: 'daylight, bright, sunny, simple, boring, low detail',
    imageUrl: 'https://picsum.photos/seed/tokyo-neon/800/1200',
    tags: ['Cyberpunk', 'Neon', 'Techwear', 'Night'],
    aspectRatio: '9:16'
  },
  {
    id: 'street-3',
    title: 'New York Urban Casual',
    category: 'Streetwear',
    style: 'Urban',
    lighting: 'Overcast',
    prompt: 'Candid urban fashion shot in New York City, model leaning against a brick wall, wearing a vintage hoodie and baggy cargo pants, soft overcast daylight, gritty city texture, realistic street vibe, 50mm lens.',
    negativePrompt: 'studio, fake, plastic, oversaturated, bright sun',
    imageUrl: 'https://picsum.photos/seed/nyc-urban/800/1200',
    tags: ['NYC', 'Urban', 'Vintage', 'Candid'],
    aspectRatio: '3:4'
  },
  {
    id: 'street-4',
    title: 'London Underground Aesthetic',
    category: 'Streetwear',
    style: 'Gritty',
    lighting: 'Fluorescent',
    prompt: 'Edgy fashion photography inside a London tube station, model in punk-inspired streetwear, fluorescent tunnel lighting, motion blur of a passing train, raw and gritty aesthetic, high grain, cinematic film stock.',
    negativePrompt: 'clean, bright, happy, sunny, polished',
    imageUrl: 'https://picsum.photos/seed/london-tube/800/1200',
    tags: ['London', 'Punk', 'Underground', 'Gritty'],
    aspectRatio: '16:9'
  },

  // LOOKBOOK CATEGORY
  {
    id: 'lookbook-1',
    title: 'Minimalist Sage Silk',
    category: 'Lookbook',
    style: 'Minimalist',
    lighting: 'Natural Light',
    prompt: 'Minimalist lookbook shot, model sitting on a designer wooden chair, wearing a high-quality silk dress in sage green, neutral beige background, soft side lighting creating gentle shadows, elegant and sophisticated vibe.',
    negativePrompt: 'cluttered, busy, loud colors, cheap, low quality',
    imageUrl: 'https://picsum.photos/seed/minimal-silk/800/1200',
    tags: ['Minimalist', 'Silk', 'Elegant', 'Neutral'],
    aspectRatio: '1:1'
  },
  {
    id: 'lookbook-2',
    title: 'Sustainable Earth Tones',
    category: 'Lookbook',
    style: 'Organic',
    lighting: 'Warm Sunlight',
    prompt: 'Eco-friendly fashion lookbook, model in organic cotton knitwear, earth tones (terracotta and olive), outdoor setting with dry grass, warm afternoon sunlight, soft focus, natural and sustainable aesthetic.',
    negativePrompt: 'synthetic, plastic, neon, industrial, cold',
    imageUrl: 'https://picsum.photos/seed/eco-fashion/800/1200',
    tags: ['Sustainable', 'Organic', 'Earth Tones', 'Warm'],
    aspectRatio: '4:5'
  },
  {
    id: 'lookbook-3',
    title: 'Scandi-Style Winter',
    category: 'Lookbook',
    style: 'Scandinavian',
    lighting: 'Soft Daylight',
    prompt: 'Scandinavian winter fashion lookbook, model in oversized wool coat and chunky scarf, minimalist apartment interior, soft morning daylight through large windows, clean lines, cozy but professional, high-end lifestyle.',
    negativePrompt: 'dark, messy, colorful, cheap, cluttered',
    imageUrl: 'https://picsum.photos/seed/scandi-winter/800/1200',
    tags: ['Winter', 'Wool', 'Scandi', 'Lifestyle'],
    aspectRatio: '3:4'
  },

  // ARTISTIC CATEGORY
  {
    id: 'art-1',
    title: 'Surreal Floral Fusion',
    category: 'Artistic',
    style: 'Surrealism',
    lighting: 'Dreamy',
    prompt: 'Surreal fashion art, model whose dress is made of blooming colorful flowers, floating in a dreamlike lavender field, ethereal glowing atmosphere, soft pastel colors, magical realism, highly detailed digital art.',
    negativePrompt: 'realistic, boring, dark, scary, messy, low quality',
    imageUrl: 'https://picsum.photos/seed/surreal-floral/800/1200',
    tags: ['Surreal', 'Floral', 'Dreamy', 'Art'],
    aspectRatio: '9:16'
  },
  {
    id: 'art-2',
    title: 'Oil Painting Portrait',
    category: 'Artistic',
    style: 'Oil Painting',
    lighting: 'Chiaroscuro',
    prompt: 'Classical oil painting style fashion portrait, model in a Renaissance-inspired gown, rich brushstrokes, deep textures, chiaroscuro lighting (Rembrandt style), dark moody background, masterpiece quality.',
    negativePrompt: 'photo, realistic, digital, clean, modern',
    imageUrl: 'https://picsum.photos/seed/oil-painting/800/1200',
    tags: ['Renaissance', 'Painting', 'Classic', 'Art'],
    aspectRatio: '3:4'
  },
  {
    id: 'art-3',
    title: '3D Render Futuristic',
    category: 'Artistic',
    style: '3D Render',
    lighting: 'Global Illumination',
    prompt: 'Futuristic 3D character design, model in liquid metal armor, Octane Render, global illumination, ray-tracing, hyper-detailed textures, sci-fi aesthetic, sleek and polished, Unreal Engine 5 style.',
    negativePrompt: '2d, drawing, sketch, low poly, blurry',
    imageUrl: 'https://picsum.photos/seed/3d-render/800/1200',
    tags: ['3D', 'Futuristic', 'Sci-Fi', 'Render'],
    aspectRatio: '1:1'
  },

  // SPORTSWEAR CATEGORY
  {
    id: 'sport-1',
    title: 'Dynamic Rooftop Run',
    category: 'Sportswear',
    style: 'Action',
    lighting: 'Sunrise',
    prompt: 'Action shot of an athlete running in modern compression sportswear, urban rooftop setting at dawn, motion blur on the background, sharp focus on the subject, dramatic sunrise lighting, high energy, professional sports photography.',
    negativePrompt: 'static, lazy, indoor, bad lighting, blurry subject',
    imageUrl: 'https://picsum.photos/seed/sport-rooftop/800/1200',
    tags: ['Sportswear', 'Action', 'Urban', 'Sunrise'],
    aspectRatio: '16:9'
  },
  {
    id: 'sport-2',
    title: 'Yoga Zen Garden',
    category: 'Sportswear',
    style: 'Lifestyle',
    lighting: 'Soft Morning',
    prompt: 'Peaceful yoga fashion shot, model in seamless leggings and sports bra, Japanese zen garden background, soft morning mist, gentle sunlight, calm and serene atmosphere, high-end wellness photography.',
    negativePrompt: 'aggressive, dark, messy, urban, noisy',
    imageUrl: 'https://picsum.photos/seed/yoga-zen/800/1200',
    tags: ['Yoga', 'Zen', 'Wellness', 'Soft'],
    aspectRatio: '4:5'
  },

  // LUXURY CATEGORY
  {
    id: 'luxury-1',
    title: 'Red Carpet Glamour',
    category: 'Luxury',
    style: 'Paparazzi',
    lighting: 'Flash',
    prompt: 'Luxury fashion event, model in a sparkling gold evening gown, walking down a red carpet, multiple camera flashes in the background, high-energy celebrity vibe, glamorous and expensive look, sharp focus.',
    negativePrompt: 'casual, poor, dark, blurry, cheap',
    imageUrl: 'https://picsum.photos/seed/red-carpet/800/1200',
    tags: ['Luxury', 'Glamour', 'Gold', 'Event'],
    aspectRatio: '3:4'
  },
  {
    id: 'luxury-2',
    title: 'Private Jet Lifestyle',
    category: 'Luxury',
    style: 'Lifestyle',
    lighting: 'Warm Interior',
    prompt: 'High-end luxury lifestyle, model sitting in a private jet cabin, wearing a cashmere travel set, holding a designer leather bag, warm interior lighting, soft bokeh through the window, sophisticated and wealthy aesthetic.',
    negativePrompt: 'public, cheap, crowded, economy, messy',
    imageUrl: 'https://picsum.photos/seed/private-jet/800/1200',
    tags: ['Luxury', 'Cashmere', 'Jet', 'Wealthy'],
    aspectRatio: '16:9'
  },
  {
    id: 'luxury-3',
    title: 'Vogue Cover Style',
    category: 'Luxury',
    style: 'Editorial',
    lighting: 'Studio Strobe',
    prompt: 'Vogue magazine cover style, model in a high-fashion black suit, bold pose, minimalist background, sharp strobe lighting, high contrast, iconic fashion photography, sophisticated and powerful.',
    negativePrompt: 'casual, messy, low quality, amateur',
    imageUrl: 'https://picsum.photos/seed/vogue-style/800/1200',
    tags: ['Vogue', 'Editorial', 'Power', 'Suit'],
    aspectRatio: '3:4'
  },

  // VINTAGE CATEGORY
  {
    id: 'vintage-1',
    title: '90s Film Aesthetic',
    category: 'Vintage',
    style: '90s Retro',
    lighting: 'Natural Grainy',
    prompt: '90s retro fashion photography, model in denim jacket and vintage sunglasses, grainy film texture, slightly faded colors, natural outdoor lighting, nostalgic vibe, 35mm film aesthetic.',
    negativePrompt: 'modern, digital, sharp, clean, 4k, hd',
    imageUrl: 'https://picsum.photos/seed/90s-retro/800/1200',
    tags: ['90s', 'Retro', 'Film', 'Nostalgic'],
    aspectRatio: '3:4'
  },
  {
    id: 'vintage-2',
    title: '70s Disco Vibe',
    category: 'Vintage',
    style: '70s Disco',
    lighting: 'Colorful Party',
    prompt: '70s disco fashion, model in sequined flare pants, dancing under a disco ball, colorful party lights, warm and vibrant atmosphere, vintage film look, high energy, retro glam.',
    negativePrompt: 'boring, dark, modern, simple, clean',
    imageUrl: 'https://picsum.photos/seed/70s-disco/800/1200',
    tags: ['70s', 'Disco', 'Sequins', 'Retro'],
    aspectRatio: '1:1'
  }
];
