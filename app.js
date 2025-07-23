/**
 * 3D 발 분석기 - 메인 애플리케이션 (리포트 다운로드 기능 추가)
 * 정밀한 발 측정 및 분석 시스템
 */

import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==================== 글로벌 변수 ====================
let perspectiveCamera, orthographicCamera, activeCamera;
let scene, renderer, controls;
let currentModel, currentGeometry, gridHelper;
let boxHelper;
let measurementLines = [];
let footMeasurements = {};
let currentFileName = '';

// ==================== DOM 요소 참조 ====================
const welcomeScreen = document.getElementById('welcome-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const canvasContainer = document.getElementById('canvas-container');
const reportFilename = document.getElementById('report-filename');
const fileSelectButton = document.getElementById('file-select-button');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const controlPanel = document.getElementById('control-panel');
const modelFilename = document.getElementById('model-filename');
const viewButtons = document.querySelectorAll('.view-btn');
const perspectiveCamBtn = document.getElementById('perspective-cam-btn');
const orthoCamBtn = document.getElementById('ortho-cam-btn');
const standardViewsContainer = document.getElementById('standard-views-container');
const viewTopBtn = document.getElementById('view-top-btn');
const viewFrontBtn = document.getElementById('view-front-btn');
const viewSideBtn = document.getElementById('view-side-btn');
const colorPicker = document.getElementById('model-color-picker');
const gridToggleBtn = document.getElementById('grid-toggle-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const captureBtn = document.getElementById('capture-btn');
const downloadReportBtn = document.getElementById('download-report-btn');
const generateQrBtn = document.getElementById('generate-qr-btn');
const qrCodeContainer = document.getElementById('qr-code');
const openNewModelBtn = document.getElementById('open-new-model-btn');
const bboxToggleBtn = document.getElementById('bbox-toggle-btn');
const measurementToggleBtn = document.getElementById('measurement-toggle-btn');
const lengthValue = document.getElementById('length-value');
const widthValue = document.getElementById('width-value');
const heightValue = document.getElementById('height-value');
const measureViewBtns = document.querySelectorAll('.measure-view-btn');
const analysisStatus = document.getElementById('analysis-status');
const confidenceScore = document.getElementById('confidence-score');
const footAnalysis = document.getElementById('foot-analysis');
const lengthWidthRatio = document.getElementById('length-width-ratio');
const heightLengthRatio = document.getElementById('height-length-ratio');

// ==================== 초기화 함수 ====================

function init() {
    console.log('🚀 3D 발 분석기 초기화 시작...');
    
    // Scene 설정
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827);

    // 카메라 설정
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    perspectiveCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000);
    
    const frustumSize = 200;
    orthographicCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2, 
        frustumSize / 2, frustumSize / -2, 
        0.1, 2000
    );
    
    activeCamera = perspectiveCamera;

    // 렌더러 설정
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true, 
        preserveDrawingBuffer: true 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    canvasContainer.appendChild(renderer.domElement);

    // 조명 설정
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);
    
    // 컨트롤 설정
    controls = new OrbitControls(activeCamera, renderer.domElement);
    controls.enableDamping = true;
    
    resetView(); 

    // 그리드 헬퍼
    gridHelper = new THREE.GridHelper(1000, 50, 0x888888, 0x444444);
    gridHelper.visible = false;
    scene.add(gridHelper);

    // 바운딩 박스 헬퍼
    boxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xffff00);
    boxHelper.visible = false;
    scene.add(boxHelper);

    // 이벤트 리스너 설정
    setupEventListeners();
    window.addEventListener('resize', onWindowResize);
    
    // 애니메이션 시작
    animate();
    
    console.log('✅ 3D 발 분석기 초기화 완료');
}

// ==================== 파일 로딩 ====================
function loadFile(file) {
    if (!file) return;

    console.log('📁 파일 로딩 시작:', file.name);
    currentFileName = file.name;
    
    // UI 전환
    welcomeScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    reportFilename.textContent = file.name;
    modelFilename.textContent = file.name;
    
    // 분석 상태 초기화
    analysisStatus.textContent = '모델 로딩 중...';
    confidenceScore.textContent = '신뢰도: 계산 중...';
    
    onWindowResize();

    const loader = new PLYLoader();
    const objectURL = URL.createObjectURL(file);

    loader.load(objectURL, (geometry) => {
        URL.revokeObjectURL(objectURL);
        
        // 기존 모델 정리
        if (currentModel) {
            scene.remove(currentModel);
            currentModel.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
        }
        if (currentGeometry) {
            currentGeometry.dispose();
        }
        
        currentGeometry = geometry;
        updateModelView('mesh');
        resetView();
        
        console.log('✅ PLY 파일 로딩 완료');
        
        // 정밀 측정 수행
        setTimeout(() => performPreciseMeasurements(), 500);
    }, undefined, (error) => {
        console.error('❌ PLY 로드 에러:', error);
        alert(`파일 로드 실패: ${error.message || '알 수 없는 오류'}`);
        welcomeScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
    });
}

// ==================== 정밀 측정 시스템 ====================
function performPreciseMeasurements() {
    if (!currentGeometry) return;
    
    console.log('🔬 정밀 측정 시작...');
    analysisStatus.textContent = '발 구조 분석 중...';
    
    const positions = currentGeometry.attributes.position.array;
    const originalVertices = [];
    
    // ⭐ 원본 geometry 정점 데이터 (스케일 적용 전)
    for (let i = 0; i < positions.length; i += 3) {
        originalVertices.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
    }
    
    // ⭐ 회전만 적용 (스케일 제외)
    const rotationMatrix = new THREE.Matrix4();
    if (currentModel) {
        rotationMatrix.makeRotationFromEuler(currentModel.rotation);
        originalVertices.forEach(vertex => vertex.applyMatrix4(rotationMatrix));
    }
    
    // ⭐ 원본 크기로 단위 자동 감지
    const bbox = new THREE.Box3().setFromPoints(originalVertices);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    let unitMultiplier = 1;
    let unit = 'mm';
    let confidence = '높음';
    
    console.log('📏 원본 모델 최대 치수:', maxDim);
    
    if (maxDim < 1) {
        unitMultiplier = 1000; // 미터 → mm
        unit = 'mm';
        confidence = '높음 (미터 단위 감지)';
    } else if (maxDim > 500) {
        unitMultiplier = 1; // 이미 mm
        unit = 'mm';
        confidence = '높음 (mm 단위 감지)';
    } else if (maxDim > 50) {
        unitMultiplier = 1; // 이미 mm로 추정
        unit = 'mm';
        confidence = '중간 (mm 단위 추정)';
    } else {
        unitMultiplier = 10; // cm → mm
        unit = 'mm';
        confidence = '중간 (cm 단위 추정)';
    }
    
    analysisStatus.textContent = '정밀 측정 수행 중...';
    
    // ⭐ 원본 크기로 정밀 측정
    const footLength = measureFootLength(originalVertices) * unitMultiplier;
    const footWidth = measureFootWidth(originalVertices) * unitMultiplier;
    const footHeight = measureFootHeight(originalVertices) * unitMultiplier;
    
    console.log('📊 측정 결과:', { footLength, footWidth, footHeight, unitMultiplier });
    
    // 측정 결과 저장
    footMeasurements = {
        length: footLength,
        width: footWidth,
        height: footHeight,
        unit: unit,
        confidence: confidence,
        originalVertices: originalVertices // 시각화용 저장
    };
    
    // UI 업데이트
    lengthValue.textContent = `${footLength.toFixed(1)} ${unit}`;
    widthValue.textContent = `${footWidth.toFixed(1)} ${unit}`;
    heightValue.textContent = `${footHeight.toFixed(1)} ${unit}`;
    
    // 비율 계산
    const lwRatio = (footLength / footWidth).toFixed(2);
    const hlRatio = (footHeight / footLength * 100).toFixed(1);
    
    lengthWidthRatio.textContent = lwRatio;
    heightLengthRatio.textContent = `${hlRatio}%`;
    
    analysisStatus.textContent = '측정 완료 - 정밀도 검증됨';
    confidenceScore.textContent = `신뢰도: ${confidence}`;
    
    // 발 유형 분석
    analyzeFootType(footLength, footWidth, footHeight);
    
    // ⭐ 화면용 스케일된 vertices로 측정선 생성
    createMeasurementLines(getScaledVertices(originalVertices));
    
    console.log('✅ 정밀 측정 완료');
}

// ⭐ 화면 표시용 스케일된 vertices 생성
function getScaledVertices(originalVertices) {
    if (!currentModel) return originalVertices;
    
    const scaledVertices = originalVertices.map(v => v.clone());
    const modelMatrix = currentModel.matrixWorld.clone();
    
    scaledVertices.forEach(vertex => {
        vertex.applyMatrix4(modelMatrix);
    });
    
    return scaledVertices;
}

// ==================== 측정 알고리즘 ====================
function measureFootLength(vertices) {
    // 발바닥 높이 기준점 찾기 (Y축 최솟값 근처)
    const minY = Math.min(...vertices.map(v => v.y));
    const footSoleThreshold = minY + (Math.max(...vertices.map(v => v.y)) - minY) * 0.15;
    
    // 발바닥 근처 점들만 필터링
    const footSoleVertices = vertices.filter(v => v.y <= footSoleThreshold);
    
    if (footSoleVertices.length === 0) {
        // 폴백: 전체 Z축 범위
        return Math.max(...vertices.map(v => v.z)) - Math.min(...vertices.map(v => v.z));
    }
    
    // 발뒤꿈치 (Z축 최솟값)
    const heelZ = Math.min(...footSoleVertices.map(v => v.z));
    
    // 발가락 끝 (Z축 최댓값)
    const toeZ = Math.max(...footSoleVertices.map(v => v.z));
    
    // 실제 족장 길이
    return toeZ - heelZ;
}

function measureFootWidth(vertices) {
    // 발볼 부위 찾기 (발 전체 길이의 60-75% 지점)
    const minZ = Math.min(...vertices.map(v => v.z));
    const maxZ = Math.max(...vertices.map(v => v.z));
    const footLength = maxZ - minZ;
    
    // 발볼 위치 (발뒤꿈치에서 60-75% 지점)
    const ballStartZ = minZ + footLength * 0.6;
    const ballEndZ = minZ + footLength * 0.75;
    
    // 발바닥 높이 기준
    const minY = Math.min(...vertices.map(v => v.y));
    const footSoleThreshold = minY + (Math.max(...vertices.map(v => v.y)) - minY) * 0.2;
    
    // 발볼 부위 점들 필터링
    const ballVertices = vertices.filter(v => 
        v.z >= ballStartZ && v.z <= ballEndZ && v.y <= footSoleThreshold
    );
    
    if (ballVertices.length === 0) {
        // 폴백: 전체 X축 범위
        return Math.max(...vertices.map(v => v.x)) - Math.min(...vertices.map(v => v.x));
    }
    
    // 발볼 너비 (X축 범위)
    const leftX = Math.min(...ballVertices.map(v => v.x));
    const rightX = Math.max(...ballVertices.map(v => v.x));
    
    return rightX - leftX;
}

function measureFootHeight(vertices) {
    // 발바닥 (Y축 최솟값)
    const soleY = Math.min(...vertices.map(v => v.y));
    
    // 발등 최고점 찾기 (발 중앙 부위에서)
    const minZ = Math.min(...vertices.map(v => v.z));
    const maxZ = Math.max(...vertices.map(v => v.z));
    const footLength = maxZ - minZ;
    
    // 발등 중앙 부위 (30-70% 지점)
    const instepStartZ = minZ + footLength * 0.3;
    const instepEndZ = minZ + footLength * 0.7;
    
    const instepVertices = vertices.filter(v => 
        v.z >= instepStartZ && v.z <= instepEndZ
    );
    
    if (instepVertices.length === 0) {
        // 폴백: 전체 Y축 범위
        return Math.max(...vertices.map(v => v.y)) - soleY;
    }
    
    // 발등 최고점
    const instepTopY = Math.max(...instepVertices.map(v => v.y));
    
    return instepTopY - soleY;
}

// 발 유형 분석 표시 함수도 수정
function analyzeFootType(length, width, height) {
    const lwRatio = length / width;
    const hlRatio = height / length;
    
    const analysis = getFootTypeAnalysis();
    
    // 종합 분석 텍스트 (한글 유지, 하지만 PDF에서는 영어 사용)
    const analysisText = `
        <div class="space-y-3">
            <div>
                <span class="font-bold text-blue-300">발 형태: ${
                    analysis.footType === 'Long Foot Type' ? '긴 발형' :
                    analysis.footType === 'Wide Foot Type' ? '넓은 발형' : '표준 발형'
                }</span> + 
                <span class="font-bold text-green-300">아치: ${
                    analysis.archType === 'High Arch' ? '높은 아치' :
                    analysis.archType === 'Low Arch / Flat Foot' ? '낮은 아치' : '정상 아치'
                }</span>
            </div>
            <p>${
                analysis.footType === 'Long Foot Type' ? '발가락이 길고 전체적으로 세련된 형태입니다.' :
                analysis.footType === 'Wide Foot Type' ? '발볼이 넓고 안정적인 형태입니다.' :
                '균형잡힌 비례를 가진 표준적인 발 형태입니다.'
            }</p>
            <div class="bg-gray-800 p-3 rounded-lg">
                <h5 class="font-semibold text-yellow-300 mb-2">추천 사항:</h5>
                <ul class="text-sm space-y-1 list-disc list-inside">
                    ${getKoreanRecommendations(lwRatio, hlRatio).map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    
    footAnalysis.innerHTML = analysisText;
}
// 한글 추천사항은 별도 함수로 분리
function getKoreanRecommendations(lwRatio, hlRatio) {
    const recommendations = [];
    
    // 길이/너비 비율 기반 추천
    if (lwRatio > 2.6) {
        recommendations.push('앞코가 여유로운 신발을 선택하세요');
        recommendations.push('좁은 신발보다는 일반 폭 이상을 권장합니다');
    } else if (lwRatio < 2.2) {
        recommendations.push('와이드 피팅 신발을 고려해보세요');
        recommendations.push('발볼 부위 압박이 적은 디자인이 좋습니다');
    }
    
    // 아치 높이 기반 추천
    if (hlRatio > 0.25) {
        recommendations.push('아치 서포트가 강한 깔창을 사용하세요');
        recommendations.push('충격 흡수 기능이 뛰어난 신발을 선택하세요');
        recommendations.push('측면 안정성이 좋은 신발이 적합합니다');
    } else if (hlRatio < 0.18) {
        recommendations.push('모션 컨트롤 기능이 있는 신발을 권장합니다');
        recommendations.push('오버프로네이션 방지 기능을 확인하세요');
        recommendations.push('단단한 뒤꿈치 지지대가 있는 신발이 좋습니다');
    } else {
        recommendations.push('일반적인 러닝화나 워킹화가 적합합니다');
        recommendations.push('적당한 쿠셔닝과 안정성을 제공하는 신발을 선택하세요');
    }
    
    return recommendations;
}

function getRecommendations(lwRatio, hlRatio) {
    const recommendations = [];
    
    // 길이/너비 비율 기반 추천 (영어로 변경)
    if (lwRatio > 2.6) {
        recommendations.push('Choose shoes with spacious toe box for comfort');
        recommendations.push('Consider regular or wide width fittings');
    } else if (lwRatio < 2.2) {
        recommendations.push('Look for wide-fitting shoes to accommodate broad forefoot');
        recommendations.push('Avoid shoes with narrow or pointed toe designs');
    } else {
        recommendations.push('Standard width shoes should fit comfortably');
        recommendations.push('Most regular shoe designs will work well');
    }
    
    // 아치 높이 기반 추천 (영어로 변경)
    if (hlRatio > 0.25) {
        recommendations.push('Use insoles with strong arch support');
        recommendations.push('Choose shoes with excellent shock absorption');
        recommendations.push('Look for shoes with good lateral stability');
    } else if (hlRatio < 0.18) {
        recommendations.push('Consider motion control shoes for overpronation');
        recommendations.push('Look for shoes with firm heel counters');
        recommendations.push('Avoid shoes with excessive cushioning');
    } else {
        recommendations.push('Regular running or walking shoes are suitable');
        recommendations.push('Choose shoes with moderate cushioning and stability');
    }
    
    return recommendations;
}

// ==================== 측정선 시각화 ====================
function createMeasurementLines(vertices) {
    // 기존 측정선 제거
    measurementLines.forEach(line => scene.remove(line));
    measurementLines = [];
    
    if (!vertices.length) return;
    
    // ⭐ 화면에 표시된 모델 기준으로 측정선 생성
    // 발 길이 측정선 (빨간색)
    const minY = Math.min(...vertices.map(v => v.y));
    const maxY = Math.max(...vertices.map(v => v.y));
    const footSoleThreshold = minY + (maxY - minY) * 0.15;
    const footSoleVertices = vertices.filter(v => v.y <= footSoleThreshold);
    
    if (footSoleVertices.length > 0) {
        const heelZ = Math.min(...footSoleVertices.map(v => v.z));
        const toeZ = Math.max(...footSoleVertices.map(v => v.z));
        const centerX = (Math.min(...vertices.map(v => v.x)) + Math.max(...vertices.map(v => v.x))) / 2;
        
        const lengthLine = createLine(
            new THREE.Vector3(centerX, minY - 5, heelZ),
            new THREE.Vector3(centerX, minY - 5, toeZ),
            0xff0000
        );
        lengthLine.userData.type = 'length';
        measurementLines.push(lengthLine);
        scene.add(lengthLine);
    }
    
    // 발 너비 측정선 (노란색)
    const minZ = Math.min(...vertices.map(v => v.z));
    const maxZ = Math.max(...vertices.map(v => v.z));
    const footLength = maxZ - minZ;
    const ballZ = minZ + footLength * 0.67; // 발볼 위치
    
    const ballVertices = vertices.filter(v => 
        Math.abs(v.z - ballZ) < footLength * 0.1 && v.y <= footSoleThreshold
    );
    
    if (ballVertices.length > 0) {
        const leftX = Math.min(...ballVertices.map(v => v.x));
        const rightX = Math.max(...ballVertices.map(v => v.x));
        
        const widthLine = createLine(
            new THREE.Vector3(leftX, minY - 3, ballZ),
            new THREE.Vector3(rightX, minY - 3, ballZ),
            0xffff00
        );
        widthLine.userData.type = 'width';
        measurementLines.push(widthLine);
        scene.add(widthLine);
    }
    
    // 발 높이 측정선 (보라색)
    const instepZ = minZ + footLength * 0.5; // 발등 중앙
    const instepVertices = vertices.filter(v => Math.abs(v.z - instepZ) < footLength * 0.1);
    
    if (instepVertices.length > 0) {
        const instepTopY = Math.max(...instepVertices.map(v => v.y));
        const centerX2 = (Math.min(...vertices.map(v => v.x)) + Math.max(...vertices.map(v => v.x))) / 2;
        
        const heightLine = createLine(
            new THREE.Vector3(centerX2 + 15, minY, instepZ),
            new THREE.Vector3(centerX2 + 15, instepTopY, instepZ),
            0xff00ff
        );
        heightLine.userData.type = 'height';
        measurementLines.push(heightLine);
        scene.add(heightLine);
    }
}

function createLine(start, end, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ 
        color: color, 
        linewidth: 3,
        transparent: true,
        opacity: 0.8
    });
    const line = new THREE.Line(geometry, material);
    line.userData.className = 'measurement-line';
    return line;
}

// ======PDF 생성 함수=======
function generatePDFReport() {
    if (!footMeasurements.length && !footMeasurements.length === 0) {
        alert('측정 데이터가 없습니다. 먼저 3D 모델을 로드해주세요.');
        return;
    }

    // jsPDF 라이브러리 확인
    if (typeof window.jspdf === 'undefined') {
        console.error('jsPDF 라이브러리가 로드되지 않았습니다.');
        alert('PDF 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 제목
    doc.setFontSize(20);
    doc.text('3D Foot Analysis Report', 20, 30);
    
    // 파일 정보
    doc.setFontSize(12);
    doc.text(`File: ${currentFileName}`, 20, 50);
    doc.text(`Analysis Date: ${new Date().toLocaleDateString()}`, 20, 60);
    
    // 측정 데이터
    doc.setFontSize(16);
    doc.text('Measurement Data', 20, 80);
    
    doc.setFontSize(12);
    const measurements = [
        `Foot Length: ${footMeasurements.length?.toFixed(1) || 'N/A'} ${footMeasurements.unit || 'mm'}`,
        `Foot Width: ${footMeasurements.width?.toFixed(1) || 'N/A'} ${footMeasurements.unit || 'mm'}`,
        `Foot Height: ${footMeasurements.height?.toFixed(1) || 'N/A'} ${footMeasurements.unit || 'mm'}`,
        `Confidence: ${footMeasurements.confidence || 'N/A'}`
    ];
    
    let yPos = 100;
    measurements.forEach(measurement => {
        doc.text(measurement, 20, yPos);
        yPos += 15;
    });
    
    // 비율 분석
    doc.setFontSize(16);
    doc.text('Ratio Analysis', 20, yPos + 10);
    yPos += 30;
    
    doc.setFontSize(12);
    if (footMeasurements.length && footMeasurements.width) {
        const lwRatio = (footMeasurements.length / footMeasurements.width).toFixed(2);
        const hlRatio = (footMeasurements.height / footMeasurements.length * 100).toFixed(1);
        
        doc.text(`Length/Width Ratio: ${lwRatio}`, 20, yPos);
        doc.text(`Height/Length Ratio: ${hlRatio}%`, 20, yPos + 15);
        yPos += 40;
    }
    
    // 발 유형 분석
    doc.setFontSize(16);
    doc.text('Foot Type Analysis', 20, yPos);
    yPos += 20;
    
    doc.setFontSize(12);
    if (footMeasurements.length && footMeasurements.width) {
        const analysis = getFootTypeAnalysis();
        doc.text(`Foot Shape: ${analysis.footType}`, 20, yPos);
        doc.text(`Arch Type: ${analysis.archType}`, 20, yPos + 15);
        yPos += 40;
    }
    
    // 추천 사항
    doc.setFontSize(16);
    doc.text('Recommendations', 20, yPos);
    yPos += 20;
    
    doc.setFontSize(10);
    const recommendations = getRecommendations(
        footMeasurements.length / footMeasurements.width || 2.4,
        footMeasurements.height / footMeasurements.length || 0.2
    );
    
    recommendations.forEach(rec => {
        if (yPos > 270) {
            doc.addPage();
            yPos = 20;
        }
        // 한글 제거하고 영어로만 표시
        const englishRec = rec.replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, '').trim();
        if (englishRec.length > 0) {
            doc.text(`• ${englishRec}`, 20, yPos);
        } else {
            doc.text(`• Shoe recommendation based on foot analysis`, 20, yPos);
        }
        yPos += 12;
    });
    
    // 3D 모델 캡처 이미지 추가
    try {
        renderer.render(scene, activeCamera);
        const imageData = renderer.domElement.toDataURL('image/jpeg', 0.8);
        
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }
        
        doc.setFontSize(16);
        doc.text('3D Model View', 20, yPos);
        doc.addImage(imageData, 'JPEG', 20, yPos + 10, 160, 120);
    } catch (error) {
        console.warn('3D 모델 이미지 추가 실패:', error);
    }
    
    // PDF 저장
    const fileName = `foot_analysis_${currentFileName.replace('.ply', '')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    
    console.log('📄 PDF 리포트 생성 완료:', fileName);
}


// ==================== QR 코드 생성 & 공유 ====================
let reportData = null;

function generateQRCode() {
  // 1) 측정 데이터 유효성 체크
  if (!footMeasurements || Object.keys(footMeasurements).length === 0) {
    alert('측정 데이터가 없습니다. 먼저 3D 모델을 로드해주세요.');
    return;
  }

  // 2) 라이브러리 확인
  if (typeof window.QRCode === 'undefined') {
    console.error('QRCode 라이브러리가 로드되지 않았습니다.');
    alert('QR 코드 라이브러리를 로드하지 못했습니다. 스크립트 포함 여부를 확인하세요.');
    return;
  }

  generateQrBtn.textContent = 'QR 코드 생성 중...';
  generateQrBtn.disabled = true;

  // 3) 리포트 데이터 구성
  const len = footMeasurements.length;
  const wid = footMeasurements.width;
  const hei = footMeasurements.height;

  reportData = {
    fileName: currentFileName,
    analysisDate: new Date().toISOString(),
    measurements: {
      length:   (typeof len === 'number') ? len.toFixed(1) : 'N/A',
      width:    (typeof wid === 'number') ? wid.toFixed(1) : 'N/A',
      height:   (typeof hei === 'number') ? hei.toFixed(1) : 'N/A',
      unit:     footMeasurements.unit || 'mm',
      confidence: footMeasurements.confidence ?? 'N/A'
    },
    ratios: {
      lengthWidth: (len && wid) ? (len / wid).toFixed(2) : 'N/A',
      heightLength: (hei && len) ? ((hei / len) * 100).toFixed(1) + '%' : 'N/A'
    },
    analysis: getFootTypeAnalysis(),
    recommendations: getRecommendations(
      (len && wid) ? len / wid : 2.4,
      (hei && len) ? hei / len : 0.2
    )
  };

  // 4) 데이터 인코딩
  const jsonData    = JSON.stringify(reportData);
  const encodedData = btoa(unescape(encodeURIComponent(jsonData)));

  // 5) 모바일 리포트 URL (파일명 맞추기!)
//   const viewerURL = `${location.origin}/mobile-report.html?data=${encodedData}`;
  const ipAddress = '192.168.00.00'; // 1단계에서 확인한 IP 주소를 여기에 입력하세요.
  const port = '5500'; // VS Code Live Server의 기본 포트입니다. 다른 경우 수정하세요.
  const viewerURL = `http://${ipAddress}:${port}/mobile-report.html?data=${encodedData}`;
  console.log('🔗 생성된 URL:', viewerURL);

  // 6) QR 컨테이너 초기화 & 생성
  const qrCodeContainer = document.getElementById('qr-code');
  qrCodeContainer.innerHTML = '';

  const qr = new window.QRCode(qrCodeContainer, {
    text: viewerURL,
    width: 256,
    height: 256,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: window.QRCode.CorrectLevel.H
  });

  // 7) UI 복구 & 메시지
  generateQrBtn.textContent = 'QR 코드 생성';
  generateQrBtn.disabled = false;

  const successMsg = document.createElement('div');
  successMsg.className = 'text-green-500 text-xs mt-2';
  successMsg.textContent = 'QR 코드 생성 완료!';
  qrCodeContainer.parentElement.appendChild(successMsg);
  setTimeout(() => successMsg.remove(), 3000);
}


// 발 유형 분석도 영어로 수정
function getFootTypeAnalysis() {
    if (!footMeasurements.length || !footMeasurements.width || !footMeasurements.height) {
        return { 
            footType: 'Analysis Pending', 
            archType: 'Analysis Pending', 
            description: 'Insufficient data for comprehensive analysis' 
        };
    }

    const lwRatio = footMeasurements.length / footMeasurements.width;
    const hlRatio = footMeasurements.height / footMeasurements.length;
    
    let footType = '';
    let description = '';
    
    if (lwRatio > 2.6) {
        footType = 'Long Foot Type';
        description = 'Elongated foot shape with longer toes and narrow profile';
    } else if (lwRatio < 2.2) {
        footType = 'Wide Foot Type';
        description = 'Broader foot shape with wider forefoot area';
    } else {
        footType = 'Normal Foot Type';
        description = 'Well-balanced foot proportions with standard dimensions';
    }
    
    let archType = '';
    if (hlRatio > 0.25) {
        archType = 'High Arch';
    } else if (hlRatio < 0.18) {
        archType = 'Low Arch / Flat Foot';
    } else {
        archType = 'Normal Arch';
    }
    
    return { footType, archType, description };
}

// ==================== 모바일 리포트 뷰어 HTML 생성 ====================
function createMobileReportViewer() {
    // 이 함수는 실제로는 별도의 mobile-report.html 파일을 생성하거나
    // 서버에서 제공해야 하지만, 여기서는 간단한 예시로 구현
    const mobileHTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>발 분석 리포트 - 모바일</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="container mx-auto p-4">
        <div class="bg-white rounded-lg shadow-lg p-6">
            <h1 class="text-2xl font-bold text-gray-800 mb-4">3D 발 분석 리포트</h1>
            <div id="report-content">
                <!-- 리포트 내용이 JavaScript로 동적 생성됩니다 -->
            </div>
            <button onclick="downloadPDF()" class="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-lg">
                📄 PDF 다운로드
            </button>
        </div>
    </div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script>
        // URL 파라미터에서 데이터 추출
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('data');
        
        if (encodedData) {
            try {
                const jsonData = decodeURIComponent(escape(atob(encodedData)));
                const reportData = JSON.parse(jsonData);
                displayReport(reportData);
            } catch (error) {
                document.getElementById('report-content').innerHTML = 
                    '<p class="text-red-500">리포트 데이터를 불러올 수 없습니다.</p>';
            }
        }
        
        function displayReport(data) {
            const content = document.getElementById('report-content');
            content.innerHTML = \`
                <div class="space-y-4">
                    <div>
                        <h3 class="text-lg font-semibold">파일 정보</h3>
                        <p>파일명: \${data.fileName}</p>
                        <p>분석일: \${new Date(data.analysisDate).toLocaleDateString('ko-KR')}</p>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold">측정 데이터</h3>
                        <p>발 길이: \${data.measurements.length} \${data.measurements.unit}</p>
                        <p>발 너비: \${data.measurements.width} \${data.measurements.unit}</p>
                        <p>발 높이: \${data.measurements.height} \${data.measurements.unit}</p>
                        <p>신뢰도: \${data.measurements.confidence}</p>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold">비율 분석</h3>
                        <p>길이/너비 비율: \${data.ratios.lengthWidth}</p>
                        <p>높이/길이 비율: \${data.ratios.heightLength}</p>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold">발 유형</h3>
                        <p>발 형태: \${data.analysis.footType}</p>
                        <p>아치 유형: \${data.analysis.archType}</p>
                        <p>\${data.analysis.description}</p>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold">추천 사항</h3>
                        <ul class="list-disc list-inside">
                            \${data.recommendations.map(rec => \`<li>\${rec}</li>\`).join('')}
                        </ul>
                    </div>
                </div>
            \`;
        }
        
        function downloadPDF() {
            // 모바일에서 PDF 다운로드 기능
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // PDF 생성 로직 (위의 generatePDFReport와 유사)
            // ... (간단화를 위해 생략)
            
            doc.save('foot_analysis_mobile.pdf');
        }
    </script>
</body>
</html>
    `;
    
    return mobileHTML;
}

// ==================== 3D 뷰어 제어 ====================
function resetView() {
    controls.reset();
    perspectiveCamera.position.set(0, 50, 200);
    perspectiveCamera.zoom = 1;
    perspectiveCamera.updateProjectionMatrix();
    controls.target.set(0,0,0);
    controls.update();
}

function updateModelView(viewType) {
    if (!currentGeometry) return;
    if (currentModel) {
        scene.remove(currentModel);
         currentModel.traverse(child => {
            if (child.isMesh || child.isPoints) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
    }

    let material;
    const currentColor = colorPicker.value;
    
    const baseMaterialProps = {
        color: currentColor,
        vertexColors: currentGeometry.hasAttribute('color'),
        side: THREE.DoubleSide,
    };

    switch(viewType) {
        case 'points':
            material = new THREE.PointsMaterial({ ...baseMaterialProps, size: 0.1 });
            break;
        case 'wireframe':
            material = new THREE.MeshBasicMaterial({ ...baseMaterialProps, wireframe: true });
            break;
        case 'mesh':
        default:
            material = new THREE.MeshStandardMaterial({ ...baseMaterialProps, flatShading: true });
            break;
    }

    const mesh = (viewType === 'points') ? new THREE.Points(currentGeometry, material) : new THREE.Mesh(currentGeometry, material);
    currentModel = new THREE.Group();
    currentModel.add(mesh);
    scene.add(currentModel);

    const initialBox = new THREE.Box3().setFromObject(mesh);
    const initialSize = initialBox.getSize(new THREE.Vector3());

    if (initialSize.y > initialSize.x && initialSize.y > initialSize.z) {
        currentModel.rotation.x = -Math.PI / 2;
    } else if (initialSize.x > initialSize.y && initialSize.x > initialSize.z) {
        currentModel.rotation.z = -Math.PI / 2;
    }

    const rotatedBox = new THREE.Box3().setFromObject(currentModel);
    const center = rotatedBox.getCenter(new THREE.Vector3());
    currentModel.position.sub(center);
    
    const realSize = rotatedBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(realSize.x, realSize.y, realSize.z);
    const desiredSize = 150;
    const scale = desiredSize / maxDim;
    currentModel.scale.set(scale, scale, scale);
    
    const finalBox = new THREE.Box3().setFromObject(currentModel);
    gridHelper.position.y = finalBox.min.y;
    
    boxHelper.box.setFromObject(currentModel);

    updateActiveButton(viewType);
}

function onWindowResize() {
    if (!renderer || !activeCamera) return;
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    
    if (activeCamera.isPerspectiveCamera) {
        activeCamera.aspect = aspect;
    } else {
        const frustumSize = 200 / (activeCamera.zoom || 1);
        activeCamera.left = frustumSize * aspect / -2;
        activeCamera.right = frustumSize * aspect / 2;
        activeCamera.top = frustumSize / 2;
        activeCamera.bottom = frustumSize / -2;
    }
    
    activeCamera.updateProjectionMatrix();
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, activeCamera);
}

// ==================== 이벤트 리스너 설정 ==================== 
function setupEventListeners() {
    // 파일 로딩 관련
    fileSelectButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => loadFile(e.target.files[0]));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        loadFile(e.dataTransfer.files[0]);
    });

    // 뷰 모드 버튼
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => updateModelView(btn.dataset.view));
    });
    
    // 기본 제어 버튼
    resetViewBtn.addEventListener('click', resetView);
    openNewModelBtn.addEventListener('click', () => {
        welcomeScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
    });
    
    // 화면 캡처
    captureBtn.addEventListener('click', () => {
        renderer.render(scene, activeCamera);
        const imageURL = renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imageURL;
        link.download = 'capture.png';
        link.click();
    });
    
    // 리포트 다운로드
    downloadReportBtn.addEventListener('click', generatePDFReport);
    
    // QR 코드 생성
    generateQrBtn.addEventListener('click', generateQRCode);
    
    // 색상 변경
    colorPicker.addEventListener('input', (e) => {
        if(currentModel) {
            currentModel.traverse(child => {
                if(child.isMesh || child.isPoints) {
                    child.material.color.set(e.target.value);
                }
            });
        }
    });
    
    // 그리드 토글
    gridToggleBtn.addEventListener('click', () => {
        let isGridVisible = !gridHelper.visible;
        gridHelper.visible = isGridVisible;
        gridToggleBtn.textContent = isGridVisible ? '켜기' : '끄기';
        gridToggleBtn.classList.toggle('bg-green-600', isGridVisible);
        gridToggleBtn.classList.toggle('bg-gray-700', !isGridVisible);
    });
    
    // 카메라 모드 전환
    perspectiveCamBtn.addEventListener('click', () => switchCamera('perspective'));
    orthoCamBtn.addEventListener('click', () => switchCamera('ortho'));
    
    // 표준 뷰
    viewTopBtn.addEventListener('click', () => setStandardView('top'));
    viewFrontBtn.addEventListener('click', () => setStandardView('front'));
    viewSideBtn.addEventListener('click', () => setStandardView('side'));
    
    // 바운딩 박스 토글
    bboxToggleBtn.addEventListener('click', () => {
        let isBboxVisible = !boxHelper.visible;
        boxHelper.visible = isBboxVisible;
        bboxToggleBtn.textContent = isBboxVisible ? '켜기' : '끄기';
        bboxToggleBtn.classList.toggle('bg-green-600', isBboxVisible);
        bboxToggleBtn.classList.toggle('bg-gray-700', !isBboxVisible);
    });

    // 측정선 토글
    measurementToggleBtn.addEventListener('click', () => {
        const isVisible = measurementLines.length > 0 && measurementLines[0].visible;
        measurementLines.forEach(line => line.visible = !isVisible);
        measurementToggleBtn.textContent = !isVisible ? '켜기' : '끄기';
        measurementToggleBtn.classList.toggle('bg-green-600', !isVisible);
        measurementToggleBtn.classList.toggle('bg-gray-700', isVisible);
    });

    // 측정 보기 버튼
    measureViewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const measureType = e.target.dataset.measure;
            
            // 측정선 표시
            if (measurementLines.length > 0 && !measurementLines[0].visible) {
                measurementToggleBtn.click();
            }
            
            // 해당 측정에 최적인 뷰로 변경
            if (measureType === 'height') {
                setStandardView('side');
            } else if (measureType === 'width') {
                setStandardView('top');
            } else {
                setStandardView('top');
            }
            
            // 해당 측정선 강조 (깜빡임 효과)
            const targetLine = measurementLines.find(line => line.userData.type === measureType);
            if (targetLine) {
                highlightMeasurementLine(targetLine);
            }
        });
    });
}

function highlightMeasurementLine(line) {
    const originalOpacity = line.material.opacity;
    let count = 0;
    const blink = () => {
        line.material.opacity = line.material.opacity === originalOpacity ? 1.0 : originalOpacity;
        count++;
        if (count < 6) {
            setTimeout(blink, 300);
        } else {
            line.material.opacity = originalOpacity;
        }
    };
    blink();
}

function switchCamera(type) {
    if (type === 'perspective') {
        activeCamera = perspectiveCamera;
        standardViewsContainer.classList.add('hidden');
        perspectiveCamBtn.classList.replace('bg-gray-700', 'bg-blue-600');
        orthoCamBtn.classList.replace('bg-blue-600', 'bg-gray-700');
    } else { 
        activeCamera = orthographicCamera;
        standardViewsContainer.classList.remove('hidden');
        orthoCamBtn.classList.replace('bg-gray-700', 'bg-blue-600');
        perspectiveCamBtn.classList.replace('bg-blue-600', 'bg-gray-700');
    }
    controls.object = activeCamera;
    onWindowResize();
    controls.update();
}

function setStandardView(direction) {
    if (!currentModel) return;
    if (activeCamera !== orthographicCamera) switchCamera('ortho');

    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const fitOffset = 1.2;
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    
    let zoomSize;
    if (direction === 'top') {
        zoomSize = Math.max(size.x, size.z);
    } else if (direction === 'side') {
        zoomSize = Math.max(size.y, size.z);
    } else {
        zoomSize = Math.max(size.x, size.y);
    }

    if (aspect > 1) {
        orthographicCamera.zoom = (orthographicCamera.top - orthographicCamera.bottom) / (zoomSize * fitOffset);
    } else {
        orthographicCamera.zoom = (orthographicCamera.right - orthographicCamera.left) / (zoomSize * fitOffset * aspect);
    }
    
    const distance = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
    switch(direction) {
        case 'top': activeCamera.position.set(center.x, center.y + distance, center.z); break;
        case 'side': activeCamera.position.set(center.x + distance, center.y, center.z); break;
        default: activeCamera.position.set(center.x, center.y, center.z + distance); break;
    }
    
    controls.target.copy(center);
    activeCamera.lookAt(center);
    orthographicCamera.updateProjectionMatrix();
    controls.update();
}

function updateActiveButton(activeView) {
     viewButtons.forEach(btn => {
        if (btn.dataset.view === activeView) {
            btn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            btn.classList.add('bg-blue-600', 'hover:bg-blue-500');
        } else {
            btn.classList.remove('bg-blue-600', 'hover:bg-blue-500');
            btn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
    });
}

// ==================== 애플리케이션 시작 ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM 로딩 완료 - 애플리케이션 시작');
    init();
});

// 전역 에러 핸들링
window.addEventListener('error', (e) => {
    console.error('❌ 글로벌 에러:', e.error);
    analysisStatus.textContent = '오류가 발생했습니다.';
});

// 성능 모니터링 (개발용)
if (typeof performance !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const perfData = performance.getEntriesByType('navigation')[0];
            console.log('⚡ 페이지 로딩 성능:', {
                total: Math.round(perfData.loadEventEnd - perfData.fetchStart),
                domReady: Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart),
            }, 'ms');
        }, 0);
    });
}