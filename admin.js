// Admin Authentication
const ADMIN_PASSWORD = 'Kerege2026';
let isAdminAuthenticated = false;

// Kyrgyzstan Regions
const REGIONS = [
    'Бишкек',
    'Ош',
    'Чуйская область',
    'Ошская область',
    'Джалал-Абадская область',
    'Баткенская область',
    'Нарынская область',
    'Иссык-Кульская область',
    'Таласская область'
];

// Security Gate: Redirect to landing if unauthorized
function redirectToLanding() {
    window.location.hash = '';
    isAdminAuthenticated = false;
    document.getElementById('admin-login').style.display = 'flex';
    document.getElementById('admin-content').style.display = 'none';
    // Force show landing page
    setTimeout(() => {
        if (typeof showLanding === 'function') {
            showLanding();
        }
    }, 100);
}

// Admin Login
function adminLogin(event) {
    event.preventDefault();

    const passwordInput = document.getElementById('admin-password');
    const password = passwordInput ? passwordInput.value : '';

    if (password === ADMIN_PASSWORD) {
        isAdminAuthenticated = true;
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        loadAdminTests();
        loadAdminVideos();
    } else {
        alert('Неверный пароль');
        // Redirect on failed authentication
        redirectToLanding();
    }
}

// Toggle Password Visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('admin-password');
    const toggleIcon = document.getElementById('password-toggle-icon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.textContent = '🙈'; // Закрытый глаз
    } else {
        passwordInput.type = 'password';
        toggleIcon.textContent = '👁️'; // Открытый глаз
    }
}

// Expose functions globally for HTML onclick/onsubmit
window.adminLogin = adminLogin;
window.togglePasswordVisibility = togglePasswordVisibility;
window.redirectToLanding = redirectToLanding;

// Initialize admin form when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Admin.js loaded');

    // Find the admin login form
    const adminForm = document.querySelector('#admin-login form');
    if (adminForm) {
        console.log('✅ Admin form found, attaching event listener');
        adminForm.addEventListener('submit', adminLogin);
    } else {
        console.log('⚠️ Admin form not found yet');
    }
});

// Load Tests for Admin
async function loadAdminTests() {
    if (!window.supabaseClient) {
        // Fallback or error
        document.getElementById('admin-tests-list').innerHTML = '<p>Supabase client not initialized</p>';
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('tests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            displayAdminTests(data);
        } else {
            document.getElementById('admin-tests-list').innerHTML = '<p>Нет загруженных тестов (Supabase)</p>';
        }

    } catch (error) {
        console.warn('Error loading admin tests (check if "tests" table exists):', error);
        document.getElementById('admin-tests-list').innerHTML =
            `<p style="color: orange;">Таблица 'tests' не найдена или пуста. <br> <small>${error.message}</small></p>`;
    }
}

function displayAdminTests(tests) {
    const container = document.getElementById('admin-tests-list');

    if (!tests || tests.length === 0) {
        container.innerHTML = '<p>Тесты еще не загружены</p>';
        return;
    }

    container.innerHTML = tests.map(test => `
        <div class="admin-test-item">
            <h4>${test.name}</h4>
            <p><strong>Язык:</strong> ${test.language === 'RU' ? 'Русский' : 'Кыргызский'}</p>
            <p><strong>Длительность:</strong> ${test.duration} минут</p>
            <p><strong>Вопросов:</strong> ${test.answerKey.length}</p>
            <p><strong>Фото:</strong> ${test.photoUrls ? test.photoUrls.length : 0}</p>
            <p><strong>ID:</strong> ${test.id}</p>
            <button class="btn btn-danger" onclick="deleteTest('${test.id}')">Удалить</button>
        </div>
    `).join('');
}

// Delete Test
async function deleteTest(testId) {
    if (!confirm('Вы уверены, что хотите удалить этот тест? Это действие нельзя отменить.')) {
        return;
    }

    try {
        const response = await fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'deleteTest',
                data: { testId: testId }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            alert('Тест успешно удален!');
            loadAdminTests();
        } else {
            alert('Ошибка удаления теста: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Error deleting test:', error);
        alert('Ошибка удаления теста. Проверьте подключение к серверу.');
    }
}

// Upload Test with Multiple Photos and ORT Support
async function uploadTest(event) {
    event.preventDefault();

    if (!isAdminAuthenticated) {
        alert('Необходима авторизация');
        return;
    }

    const testName = document.getElementById('test-name').value;
    const testLanguage = document.getElementById('test-language').value;
    const testDuration = parseInt(document.getElementById('test-duration').value);
    const testPhotos = document.getElementById('test-photo').files;
    const answerKeyInput = document.getElementById('answer-key').value;

    // ORT-specific fields
    const testType = document.getElementById('test-type')?.value || 'standard';
    const questionTopicsInput = document.getElementById('question-topics')?.value || '';
    const questionWeightsInput = document.getElementById('question-weights')?.value || '';

    // Validate inputs
    if (!testPhotos || testPhotos.length === 0) {
        alert('Пожалуйста, выберите хотя бы одно фото теста');
        return;
    }

    if (testPhotos.length > 40) {
        alert('Максимум 40 фотографий');
        return;
    }

    // Parse answer key
    const answerKey = answerKeyInput
        .split(',')
        .map(a => a.trim().toUpperCase())
        .filter(a => ['A', 'B', 'C', 'D', 'E'].includes(a));

    if (answerKey.length === 0) {
        alert('Пожалуйста, введите корректный ключ ответов');
        return;
    }

    // Parse ORT fields
    let questionTopics = null;
    let questionWeights = null;

    if (questionTopicsInput.trim()) {
        try {
            questionTopics = JSON.parse(questionTopicsInput);
            if (!Array.isArray(questionTopics) || questionTopics.length !== answerKey.length) {
                alert(`Темы вопросов должны быть массивом из ${answerKey.length} элементов`);
                return;
            }
        } catch (e) {
            alert('Ошибка в формате тем вопросов. Используйте JSON массив: ["Тема1", "Тема2", ...]');
            return;
        }
    }

    if (questionWeightsInput.trim()) {
        try {
            questionWeights = JSON.parse(questionWeightsInput);
            if (!Array.isArray(questionWeights) || questionWeights.length !== answerKey.length) {
                alert(`Веса вопросов должны быть массивом из ${answerKey.length} элементов`);
                return;
            }
        } catch (e) {
            alert('Ошибка в формате весов. Используйте JSON массив: [1, 1, 2, ...]');
            return;
        }
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = `Загрузка ${testPhotos.length} фото...`;
    submitBtn.disabled = true;

    try {
        // Convert all images to base64
        const photoUrls = [];
        for (let i = 0; i < testPhotos.length; i++) {
            const base64 = await fileToBase64(testPhotos[i]);
            photoUrls.push(base64);

            // Update progress
            submitBtn.textContent = `Обработка ${i + 1}/${testPhotos.length}...`;
        }

        submitBtn.textContent = 'Сохранение в Supabase...';

        // Prepare test data for Supabase
        const testData = {
            name: testName,
            language: testLanguage,
            duration: testDuration,
            answerKey: answerKey,
            photoUrls: photoUrls,
            test_type: testType,
            topics: questionTopics,
            weights: questionWeights,
            created_at: new Date().toISOString()
        };

        // Save to Supabase
        if (window.supabaseClient) {
            const { data, error } = await window.supabaseClient
                .from('tests')
                .insert([testData])
                .select();

            if (error) {
                throw new Error(error.message);
            }

            alert(`✅ Тест успешно загружен!\n\nЗагружено ${testPhotos.length} фото.\nТип: ${testType}\nВопросов: ${answerKey.length}`);
            document.getElementById('upload-test-form').reset();
            loadAdminTests();
        } else {
            throw new Error('Supabase client not initialized');
        }
    } catch (error) {
        console.error('Error uploading test:', error);
        alert('Ошибка загрузки теста: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Video Management
// Load Videos
async function loadAdminVideos() {
    const container = document.getElementById('admin-videos-list');
    if (!container) return; // Fix "Cannot set properties of null"

    if (!window.supabaseClient) {
        container.innerHTML = '<p>Supabase client not initialized</p>';
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('videos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            displayAdminVideos(data);
        } else {
            container.innerHTML = '<p>Список видео пуст</p>';
        }

    } catch (error) {
        console.warn('Error loading videos:', error);
        container.innerHTML = `<p style="color: orange;">Таблица 'videos' не найдена. <br><small>${error.message}</small></p>`;
    }
}

function displayAdminVideos(videos) {
    const container = document.getElementById('admin-videos-list');

    if (!videos || videos.length === 0) {
        container.innerHTML = '<p>Видео еще не добавлены</p>';
        return;
    }

    container.innerHTML = videos.map(video => `
        <div class="admin-video-item">
            <h4>${video.title}</h4>
            <p><strong>Язык:</strong> ${video.language === 'RU' ? 'Русский' : 'Кыргызский'}</p>
            <p><strong>URL:</strong> <a href="${video.url}" target="_blank">${video.url}</a></p>
            <button class="btn btn-danger" onclick="deleteVideo('${video.id}')">Удалить</button>
        </div>
    `).join('');
}

async function addVideo(event) {
    event.preventDefault();

    const title = document.getElementById('video-title').value;
    const url = document.getElementById('video-url').value;
    const language = document.getElementById('video-language').value;

    try {
        const response = await fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'addVideo',
                data: { title, url, language }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            alert('Видео успешно добавлено!');
            document.getElementById('add-video-form').reset();
            loadAdminVideos();
        } else {
            alert('Ошибка добавления видео: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Error adding video:', error);
        alert('Ошибка добавления видео');
    }
}

async function deleteVideo(videoId) {
    if (!confirm('Удалить это видео?')) {
        return;
    }

    try {
        const response = await fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'deleteVideo',
                data: { videoId }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            alert('Видео удалено!');
            loadAdminVideos();
        } else {
            alert('Ошибка удаления видео: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Error deleting video:', error);
        alert('Ошибка удаления видео');
    }
}

// Certificate Generator
async function generateCertificate(event) {
    event.preventDefault();

    const fullName = document.getElementById('cert-name').value;
    const score = document.getElementById('cert-score').value;
    const testName = document.getElementById('cert-test').value;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Генерация...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'generateCertificate',
                data: { fullName, score, testName }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            alert('Сертификат создан!');
            window.open(data.pdfUrl, '_blank');
            document.getElementById('certificate-form').reset();
        } else {
            alert('Ошибка создания сертификата: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Error generating certificate:', error);
        alert('Ошибка создания сертификата');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Helper: Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Security: Monitor admin route and enforce authentication
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is trying to access admin panel
    if (window.location.hash === '#keregemanager') {
        // Show admin page with login gate
        if (typeof showAdminPage === 'function') {
            showAdminPage();
        }
    }
});

// Intercept attempts to close admin login without authentication
window.addEventListener('hashchange', () => {
    // If user navigates away from admin route, reset authentication
    if (window.location.hash !== '#keregemanager') {
        isAdminAuthenticated = false;
    }
});


// Video Management Functions - Added
async function saveVideo() {
    const title = document.getElementById('video-title').value;
    const url = document.getElementById('video-url').value;
    const lang = document.getElementById('video-language').value;

    if (!title || !url) {
        alert('Заполните все поля');
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('marketing_videos')
            .insert([{ title, youtube_url: url, language: lang }]);

        if (error) throw error;

        alert('Видео добавлено успешно!');
        document.getElementById('video-form').reset();
        loadAdminVideos();

    } catch (e) {
        console.error('Error saving video:', e);
        alert('Ошибка сохранения: ' + e.message);
    }
}

async function deleteVideo(id) {
    if (!confirm('Вы уверены, что хотите удалить это видео?')) return;

    try {
        const { error } = await window.supabaseClient
            .from('marketing_videos')
            .delete()
            .eq('id', id);

        if (error) throw error;
        loadAdminVideos();

    } catch (e) {
        console.error('Error deleting video:', e);
        alert('Ошибка удаления: ' + e.message);
    }
}

// Delete Student from CRM
async function deleteStudent(studentId) {
    if (!window.supabaseClient) {
        alert('Supabase не подключен');
        return;
    }

    // Get student name for confirmation
    const row = document.querySelector(`button[onclick="deleteStudent('${studentId}')"]`)?.closest('tr');
    const studentName = row?.querySelector('td:nth-child(2)')?.textContent.split('\n')[0] || 'этого студента';

    if (!confirm(`Удалить студента "${studentName}"?\n\nЭто действие нельзя отменить!`)) {
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('student_results')
            .delete()
            .eq('id', studentId);

        if (error) throw error;

        alert('Студент успешно удален');

        // Reload student results
        if (typeof loadStudentResults === 'function') {
            loadStudentResults();
        }

    } catch (e) {
        console.error('Error deleting student:', e);
        alert('Ошибка удаления студента: ' + e.message);
    }
}

// Make deleteStudent globally accessible
window.deleteStudent = deleteStudent;

// Make loadAdminVideos global so app.js can call it
window.loadAdminVideos = async function () {
    const container = document.getElementById('admin-videos-list');
    if (!container) return;

    if (!window.supabaseClient) {
        container.innerHTML = '<p>Supabase client not initialized</p>';
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('marketing_videos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p>Нет загруженных видео</p>';
            return;
        }

        container.innerHTML = data.map(video => `
            <div class="admin-test-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <div>
                    <strong>${video.title}</strong> (${video.language === 'RU' ? 'RU' : 'KG'})<br>
                    <small><a href="${video.youtube_url}" target="_blank">${video.youtube_url}</a></small>
                </div>
                <button class="btn btn-danger" style="padding: 5px 10px; font-size: 12px;" onclick="deleteVideo('${video.id}')">Удалить</button>
            </div>
        `).join('');

    } catch (error) {
        console.warn('Error loading videos:', error);
        container.innerHTML = `<p style="color: orange;">Ошибка загрузки видео: ${error.message}</p>`;
    }
}
