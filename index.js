<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Build Story Generator</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Roboto+Slab:wght@700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }
        h1, h2, h3 { font-family: 'Roboto Slab', serif; }
        .loader { border-top-color: #ea580c; -webkit-animation: spinner 1.5s linear infinite; animation: spinner 1.5s linear infinite; }
        @keyframes spinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* Custom Scrollbar for the answer box */
        textarea::-webkit-scrollbar { width: 8px; }
        textarea::-webkit-scrollbar-track { background: #f1f1f1; }
        textarea::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        textarea::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    </style>
</head>
<body class="text-slate-800">

    <nav class="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50 shadow-sm">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
            <div class="flex items-center gap-3">
                <div class="bg-orange-600 text-white p-2 rounded-lg shadow-orange-200 shadow-md">
                    <i class="fa-solid fa-hammer text-lg"></i>
                </div>
                <h1 class="text-xl tracking-tight text-slate-900">Fabrication<span class="text-orange-600">Story</span></h1>
            </div>
            <div class="flex gap-4 text-sm font-medium text-slate-500">
                <span><i class="fa-solid fa-circle-check text-green-500 mr-1"></i> System Ready</span>
            </div>
        </div>
    </nav>

    <main class="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        
        <div class="lg:col-span-4 space-y-6">
            
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm uppercase tracking-wide text-slate-400 font-bold">1. Project Photos</h2>
                </div>
                
                <div class="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition cursor-pointer relative group" id="dropZone">
                    <input type="file" id="imageInput" multiple accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                    <div class="transition-transform group-hover:-translate-y-1 duration-200">
                        <i class="fa-solid fa-camera text-3xl text-slate-300 mb-3 group-hover:text-orange-500"></i>
                        <p class="text-sm text-slate-500 font-medium">Upload Build Photos</p>
                        <p class="text-xs text-slate-400 mt-1">JPG or PNG</p>
                    </div>
                </div>

                <div id="imagePreview" class="grid grid-cols-3 gap-2 mt-4"></div>

                <button onclick="analyzeImages()" id="analyzeBtn" class="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-lg transition flex justify-center items-center gap-2 shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span>Analyze Construction</span>
                    <i class="fa-solid fa-chevron-right text-xs"></i>
                </button>
            </div>

            <div class="bg-blue-50 p-5 rounded-xl border border-blue-100">
                <div class="flex gap-3">
                    <i class="fa-solid fa-lightbulb text-blue-500 mt-1"></i>
                    <div>
                        <h4 class="font-bold text-blue-900 text-sm mb-1">Pro Tip</h4>
                        <p class="text-xs text-blue-700 leading-relaxed">
                            Upload close-ups of joints, wiring, or raw frames. The AI loves "Process" shots more than finished polished shots.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div class="lg:col-span-8 space-y-6">

            <div id="emptyState" class="bg-white p-12 rounded-xl shadow-sm border border-slate-100 text-center h-full flex flex-col justify-center items-center min-h-[400px]">
                <div class="bg-slate-50 p-4 rounded-full mb-4">
                    <i class="fa-regular fa-images text-4xl text-slate-300"></i>
                </div>
                <h3 class="text-lg font-bold text-slate-900 mb-2">Ready to tell the story?</h3>
                <p class="text-slate-500 max-w-md">Upload your project photos on the left. We'll analyze the geometry and materials to help you write a post that sounds like an expert.</p>
            </div>

            <div id="loading" class="hidden bg-white p-16 rounded-xl shadow-sm text-center min-h-[400px] flex flex-col justify-center items-center border border-slate-100">
                <div class="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-12 w-12 mb-6"></div>
                <h3 class="text-xl font-bold text-slate-900">Analyzing Geometry...</h3>
                <p class="text-slate-500 text-sm mt-2">Identifying materials and fabrication methods.</p>
            </div>

            <div id="questionsPanel" class="hidden bg-white p-8 rounded-xl shadow-sm border border-slate-100 min-h-[400px]">
                <div class="flex items-center gap-3 mb-6">
                    <span class="bg-slate-100 text-slate-600 font-bold text-xs px-2 py-1 rounded">STEP 2</span>
                    <h2 class="text-xl font-bold text-slate-900">Choose an Angle</h2>
                </div>
                
                <div id="questionsList" class="grid grid-cols-1 gap-3">
                    </div>

                <div id="answerSection" class="hidden mt-8 pt-8 border-t border-slate-100">
                    <label class="block text-sm font-bold text-slate-700 mb-2">
                        Your Notes <span class="font-normal text-slate-400 ml-1">(Don't worry about grammar, just dump facts)</span>
                    </label>
                    <div class="relative">
                        <textarea id="userAnswer" rows="4" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm leading-relaxed transition" placeholder="e.g., 'Honestly, the radius on this corner was a nightmare. We had to use a heat gun and 3 people to bend the laminate without cracking it...'"></textarea>
                        <i class="fa-solid fa-pencil absolute bottom-4 right-4 text-slate-300"></i>
                    </div>
                    
                    <button onclick="generatePost()" class="mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg shadow-orange-200 flex items-center gap-2">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        Generate Post
                    </button>
                </div>
            </div>

            <div id="resultPanel" class="hidden bg-white p-8 rounded-xl shadow-sm border border-slate-100 min-h-[400px]">
                <div class="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
                    <div>
                        <span class="bg-green-100 text-green-700 font-bold text-xs px-2 py-1 rounded">STEP 3</span>
                        <h2 class="text-xl font-bold text-slate-900 mt-2">Your Draft</h2>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="location.reload()" class="text-sm text-slate-500 hover:text-slate-800 px-3 py-2 rounded border border-slate-200 hover:bg-slate-50 transition">
                            Start Over
                        </button>
                        <button onclick="copyToClipboard()" class="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded shadow-md transition flex items-center gap-2">
                            <i class="fa-regular fa-copy"></i> Copy Text
                        </button>
                    </div>
                </div>
                
                <div class="bg-slate-50 p-8 rounded-xl border border-slate-200">
                    <div id="finalPost" class="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap font-medium leading-7"></div>
                </div>
                
                <div class="mt-4 text-center">
                    <p class="text-xs text-slate-400">Generated with the "Maker/Expert" Persona</p>
                </div>
            </div>

        </div>
    </main>

    <script>
        let selectedQuestion = "";
        let uploadedImages = [];

        // Handle Image Upload Preview
        document.getElementById('imageInput').addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            const previewContainer = document.getElementById('imagePreview');
            previewContainer.innerHTML = '';
            uploadedImages = [];

            if(files.length > 0) {
                document.getElementById('analyzeBtn').disabled = false;
            }

            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedImages.push(e.target.result);
                    const div = document.createElement('div');
                    div.className = 'aspect-square rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shadow-sm';
                    div.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
                    previewContainer.appendChild(div);
                };
                reader.readAsDataURL(file);
            });
        });

        async function analyzeImages() {
            if(uploadedImages.length === 0) return;
            
            setLoading(true);
            document.getElementById('emptyState').classList.add('hidden');
            document.getElementById('questionsPanel').classList.add('hidden');
            
            try {
                const response = await fetch('/api/analyze-images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images: uploadedImages })
                });
                
                const data = await response.json();
                renderQuestions(data.questions);
                
                setLoading(false);
                document.getElementById('questionsPanel').classList.remove('hidden');
            } catch (err) {
                alert("Error analyzing images");
                setLoading(false);
                document.getElementById('emptyState').classList.remove('hidden');
            }
        }

        function renderQuestions(questions) {
            const container = document.getElementById('questionsList');
            container.innerHTML = '';
            
            questions.forEach(q => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left p-5 rounded-xl border border-slate-200 hover:border-orange-500 hover:bg-orange-50 transition group relative bg-white shadow-sm';
                btn.onclick = () => selectQuestion(q.text, btn);
                
                // Icon mapping based on category
                let icon = 'fa-clipboard-question';
                if(q.category.includes('Tech')) icon = 'fa-ruler-combined';
                if(q.category.includes('Material')) icon = 'fa-layer-group';
                if(q.category.includes('Process')) icon = 'fa-truck-fast';

                btn.innerHTML = `
                    <div class="flex gap-4 items-start">
                        <div class="bg-slate-100 text-slate-400 p-3 rounded-lg group-hover:bg-white group-hover:text-orange-500 transition">
                            <i class="fa-solid ${icon} text-lg"></i>
                        </div>
                        <div>
                            <span class="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1 block">${q.category || 'Topic'}</span>
                            <span class="text-slate-700 font-medium text-sm leading-relaxed group-hover:text-slate-900">${q.text}</span>
                        </div>
                    </div>
                `;
                container.appendChild(btn);
            });
        }

        function selectQuestion(text, element) {
            selectedQuestion = text;
            // Visual selection state
            const allBtns = document.getElementById('questionsList').children;
            Array.from(allBtns).forEach(b => {
                b.classList.remove('ring-2', 'ring-orange-500', 'bg-orange-50', 'border-orange-500');
                b.classList.add('border-slate-200', 'bg-white');
            });
            
            element.classList.remove('border-slate-200', 'bg-white');
            element.classList.add('ring-2', 'ring-orange-500', 'bg-orange-50', 'border-orange-500');
            
            const answerSection = document.getElementById('answerSection');
            answerSection.classList.remove('hidden');
            answerSection.scrollIntoView({ behavior: 'smooth' });
            document.getElementById('userAnswer').focus();
        }

        async function generatePost() {
            const answer = document.getElementById('userAnswer').value;
            
            if(!answer) return alert("Please add a few rough notes first");

            setLoading(true);
            document.getElementById('questionsPanel').classList.add('hidden');

            try {
                const response = await fetch('/api/generate-post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: selectedQuestion, answer })
                });

                const data = await response.json();
                document.getElementById('finalPost').innerText = data.post;
                
                setLoading(false);
                document.getElementById('resultPanel').classList.remove('hidden');
            } catch (err) {
                alert("Error generating post");
                setLoading(false);
                document.getElementById('questionsPanel').classList.remove('hidden');
            }
        }

        function setLoading(isLoading) {
            const loader = document.getElementById('loading');
            if(isLoading) loader.classList.remove('hidden');
            else loader.classList.add('hidden');
        }

        function copyToClipboard() {
            const text = document.getElementById('finalPost').innerText;
            navigator.clipboard.writeText(text);
            
            const btn = event.currentTarget;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied`;
            btn.classList.remove('bg-slate-900');
            btn.classList.add('bg-green-600');
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.add('bg-slate-900');
                btn.classList.remove('bg-green-600');
            }, 2000);
        }
    </script>
</body>
</html>
