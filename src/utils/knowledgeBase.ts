import type {
  Sherd,
  ReconstructionScheme,
  ReconstructionMetrics,
  ProjectData,
  KnowledgeBaseEntry,
  SherdFeatureVector,
  KnowledgeBaseSearchFilter,
  SimilarityDimensionScore,
  SimilarityMatchResult,
  RecommendationResult,
  KnowledgeBaseStats,
  KnowledgeBaseSearchResult,
  FeatureWeightConfig,
  EvidenceCitation,
  ArtifactType,
  RimCurvature,
  PatternStyle,
  SherdEvidence,
  SchemeEvidence,
  ReconstructionReport,
  ConfidenceLevel,
} from '@/types';
import { DEFAULT_FEATURE_WEIGHTS, ARTIFACT_TYPE_LABELS, RIM_CURVATURE_LABELS, PATTERN_STYLE_LABELS } from '@/types';

const generateId = () => Math.random().toString(36).substr(2, 9);

export function extractFeatureVectorFromSherd(
  sherd: Sherd,
  sherdEvidence?: SherdEvidence,
  metrics?: ReconstructionMetrics
): SherdFeatureVector {
  const featureVector: SherdFeatureVector = {
    artifactType: null,
    period: null,
    dynasty: null,
    layerNumber: null,
    patternStyle: null,
    thickness: sherd.thickness || null,
    rimCurvature: null,
    estimatedRimDiameter: metrics?.estimatedRimDiameter || null,
    estimatedHeight: metrics?.estimatedHeight || null,
    wallThickness: metrics?.estimatedWallThickness || sherd.thickness || null,
  };

  if (sherdEvidence) {
    if (sherdEvidence.chronologyJudgments.length > 0) {
      const latestChronology = sherdEvidence.chronologyJudgments[0];
      featureVector.period = latestChronology.period;
      featureVector.dynasty = latestChronology.dynasty || null;
    }

    if (sherdEvidence.stratigraphyInfos.length > 0) {
      featureVector.layerNumber = sherdEvidence.stratigraphyInfos[0].layerNumber;
    }

    if (sherdEvidence.referenceArtifacts.length > 0) {
      const ref = sherdEvidence.referenceArtifacts[0];
      featureVector.artifactType = inferArtifactType(ref.artifactType);
    }
  }

  if (sherd.patternPosition) {
    featureVector.patternStyle = inferPatternStyle(sherd.patternPosition);
  }

  if (sherd.keyPoints.some((kp) => kp.type === 'rim')) {
    featureVector.rimCurvature = inferRimCurvature(sherd);
  }

  return featureVector;
}

export function extractFeatureVectorFromScheme(
  _scheme: ReconstructionScheme,
  schemeEvidence?: SchemeEvidence,
  metrics?: ReconstructionMetrics
): SherdFeatureVector {
  const featureVector: SherdFeatureVector = {
    artifactType: null,
    period: null,
    dynasty: null,
    layerNumber: null,
    patternStyle: null,
    thickness: null,
    rimCurvature: null,
    estimatedRimDiameter: metrics?.estimatedRimDiameter || null,
    estimatedHeight: metrics?.estimatedHeight || null,
    wallThickness: metrics?.estimatedWallThickness || null,
  };

  if (schemeEvidence) {
    if (schemeEvidence.chronologyJudgments.length > 0) {
      const latestChronology = schemeEvidence.chronologyJudgments[0];
      featureVector.period = latestChronology.period;
      featureVector.dynasty = latestChronology.dynasty || null;
    }

    if (schemeEvidence.stratigraphyInfos.length > 0) {
      featureVector.layerNumber = schemeEvidence.stratigraphyInfos[0].layerNumber;
    }

    if (schemeEvidence.referenceArtifacts.length > 0) {
      const ref = schemeEvidence.referenceArtifacts[0];
      featureVector.artifactType = inferArtifactType(ref.artifactType);
    }
  }

  if (metrics && metrics.estimatedRimDiameter) {
    featureVector.rimCurvature = inferRimCurvatureFromMetrics(metrics);
  }

  return featureVector;
}

function inferArtifactType(typeStr: string): ArtifactType | null {
  const lower = typeStr.toLowerCase();
  if (lower.includes('罐') || lower.includes('jar')) return 'jar';
  if (lower.includes('釜') || lower.includes('pot')) return 'pot';
  if (lower.includes('碗') || lower.includes('bowl')) return 'bowl';
  if (lower.includes('杯') || lower.includes('cup')) return 'cup';
  if (lower.includes('瓶') || lower.includes('vase')) return 'vase';
  if (lower.includes('盘') || lower.includes('plate')) return 'plate';
  if (lower.includes('碟') || lower.includes('dish')) return 'dish';
  if (lower.includes('鼎') || lower.includes('tripod')) return 'tripod';
  return 'other';
}

function inferPatternStyle(patternStr: string): PatternStyle | null {
  const lower = patternStr.toLowerCase();
  if (lower.includes('绳纹')) return 'string';
  if (lower.includes('篮纹')) return 'basket';
  if (lower.includes('弦纹')) return 'cord';
  if (lower.includes('几何')) return 'geometric';
  if (lower.includes('花卉')) return 'floral';
  if (lower.includes('动物')) return 'animal';
  if (lower.includes('人物')) return 'human';
  if (lower.includes('素面')) return 'plain';
  if (lower.includes('彩绘')) return 'painted';
  if (lower.includes('雕刻')) return 'carved';
  if (lower.includes('刻划')) return 'incised';
  if (lower.includes('戳印')) return 'stamped';
  return null;
}

function inferRimCurvature(sherd: Sherd): RimCurvature | null {
  const rimPoints = sherd.keyPoints.filter((kp) => kp.type === 'rim');
  if (rimPoints.length < 2) return null;

  const sortedByY = [...rimPoints].sort((a, b) => a.y - b.y);
  const topPoint = sortedByY[0];
  const bottomPoint = sortedByY[sortedByY.length - 1];
  const xDiff = topPoint.x - bottomPoint.x;

  if (Math.abs(xDiff) < 3) return 'straight';
  if (xDiff > 15) return 'strongly_inward';
  if (xDiff > 5) return 'slightly_inward';
  if (xDiff < -15) return 'strongly_outward';
  if (xDiff < -5) return 'slightly_outward';
  return 'flared';
}

function inferRimCurvatureFromMetrics(metrics: ReconstructionMetrics): RimCurvature | null {
  const diameter = metrics.estimatedRimDiameter;
  const height = metrics.estimatedHeight || 0;

  if (diameter < 10) return 'slightly_inward';
  if (diameter > 30 && height > 15) return 'flared';
  if (diameter > 25) return 'slightly_outward';
  return 'straight';
}

export function createSherdEntry(
  sherd: Sherd,
  sherdEvidence: SherdEvidence,
  projectData: ProjectData,
  metrics?: ReconstructionMetrics
): KnowledgeBaseEntry {
  const featureVector = extractFeatureVectorFromSherd(sherd, sherdEvidence, metrics);
  const tags = generateTags(featureVector);

  return {
    id: generateId(),
    entryType: 'sherd',
    sourceProjectId: `${projectData.name}-${projectData.createdAt}`,
    sourceProjectName: projectData.name,
    sourceProjectMetadata: projectData.metadata,
    title: `残片 ${sherd.sherdNumber}`,
    description: sherd.notes || `来自 ${projectData.name} 的陶器残片`,
    createdAt: sherd.createdAt || Date.now(),
    importedAt: Date.now(),
    tags,
    featureVector,
    sherd,
    sherdEvidence,
    schemeMetrics: metrics,
    isTrusted: false,
    viewCount: 0,
    referenceCount: 0,
  };
}

export function createSchemeEntry(
  scheme: ReconstructionScheme,
  schemeEvidence: SchemeEvidence,
  projectData: ProjectData,
  metrics?: ReconstructionMetrics
): KnowledgeBaseEntry {
  const featureVector = extractFeatureVectorFromScheme(scheme, schemeEvidence, metrics);
  const tags = generateTags(featureVector);

  return {
    id: generateId(),
    entryType: 'scheme',
    sourceProjectId: `${projectData.name}-${projectData.createdAt}`,
    sourceProjectName: projectData.name,
    sourceProjectMetadata: projectData.metadata,
    title: `复原方案：${scheme.name}`,
    description: scheme.description || `来自 ${projectData.name} 的复原方案`,
    createdAt: scheme.createdAt,
    importedAt: Date.now(),
    tags,
    featureVector,
    scheme,
    schemeEvidence,
    schemeMetrics: metrics,
    isTrusted: scheme.isTrusted,
    viewCount: 0,
    referenceCount: 0,
  };
}

export function createReportEntry(
  report: ReconstructionReport,
  projectData: ProjectData
): KnowledgeBaseEntry {
  const featureVector: SherdFeatureVector = {
    artifactType: null,
    period: null,
    dynasty: null,
    layerNumber: null,
    patternStyle: null,
    thickness: null,
    rimCurvature: null,
    estimatedRimDiameter: null,
    estimatedHeight: null,
    wallThickness: null,
  };

  return {
    id: generateId(),
    entryType: 'report',
    sourceProjectId: `${projectData.name}-${projectData.createdAt}`,
    sourceProjectName: projectData.name,
    sourceProjectMetadata: projectData.metadata,
    title: `报告：${report.schemeName}`,
    description: `生成于 ${new Date(report.generatedAt).toLocaleDateString('zh-CN')}`,
    createdAt: report.generatedAt,
    importedAt: Date.now(),
    tags: ['报告', report.format],
    featureVector,
    report,
    isTrusted: false,
    viewCount: 0,
    referenceCount: 0,
  };
}

export function createEvidenceChainEntry(
  _targetId: string,
  targetType: 'sherd' | 'scheme',
  evidence: SherdEvidence | SchemeEvidence,
  projectData: ProjectData
): KnowledgeBaseEntry {
  const featureVector: SherdFeatureVector = {
    artifactType: null,
    period: null,
    dynasty: null,
    layerNumber: null,
    patternStyle: null,
    thickness: null,
    rimCurvature: null,
    estimatedRimDiameter: null,
    estimatedHeight: null,
    wallThickness: null,
  };

  if (evidence.chronologyJudgments.length > 0) {
    featureVector.period = evidence.chronologyJudgments[0].period;
    featureVector.dynasty = evidence.chronologyJudgments[0].dynasty || null;
  }
  if (evidence.stratigraphyInfos.length > 0) {
    featureVector.layerNumber = evidence.stratigraphyInfos[0].layerNumber;
  }

  const tags = ['证据链'];
  if (featureVector.period) tags.push(featureVector.period);
  if (featureVector.layerNumber) tags.push(`层位${featureVector.layerNumber}`);

  return {
    id: generateId(),
    entryType: 'evidence_chain',
    sourceProjectId: `${projectData.name}-${projectData.createdAt}`,
    sourceProjectName: projectData.name,
    sourceProjectMetadata: projectData.metadata,
    title: `${targetType === 'sherd' ? '残片' : '方案'}证据链`,
    description: `包含 ${evidence.evidenceSources.length} 个证据来源, ${evidence.chronologyJudgments.length} 个年代判断`,
    createdAt: Date.now(),
    importedAt: Date.now(),
    tags,
    featureVector,
    evidenceChain: {
      evidenceSources: evidence.evidenceSources,
      chronologyJudgments: evidence.chronologyJudgments,
      stratigraphyInfos: evidence.stratigraphyInfos,
      referenceArtifacts: evidence.referenceArtifacts,
      expertOpinions: evidence.expertOpinions,
    },
    isTrusted: evidence.conflicts.filter((c) => !c.resolved).length === 0,
    viewCount: 0,
    referenceCount: 0,
  };
}

function generateTags(fv: SherdFeatureVector): string[] {
  const tags: string[] = [];
  if (fv.artifactType) tags.push(ARTIFACT_TYPE_LABELS[fv.artifactType]);
  if (fv.period) tags.push(fv.period);
  if (fv.dynasty) tags.push(fv.dynasty);
  if (fv.layerNumber) tags.push(`层位${fv.layerNumber}`);
  if (fv.patternStyle) tags.push(PATTERN_STYLE_LABELS[fv.patternStyle]);
  if (fv.rimCurvature) tags.push(RIM_CURVATURE_LABELS[fv.rimCurvature]);
  return tags;
}

export function calculateSimilarity(
  targetFv: SherdFeatureVector,
  entryFv: SherdFeatureVector,
  weights: FeatureWeightConfig = DEFAULT_FEATURE_WEIGHTS
): { overall: number; dimensionScores: SimilarityDimensionScore[] } {
  const dimensionScores: SimilarityDimensionScore[] = [];

  let typeScore = 0;
  if (targetFv.artifactType && entryFv.artifactType) {
    typeScore = targetFv.artifactType === entryFv.artifactType ? 100 : 0;
  }
  dimensionScores.push({
    dimension: 'type',
    score: typeScore,
    weight: weights.typeWeight,
    normalizedScore: typeScore * weights.typeWeight,
    description: typeScore > 0 ? `器型匹配：${ARTIFACT_TYPE_LABELS[targetFv.artifactType!]}` : '器型不匹配或信息不足',
  });

  let periodScore = 0;
  if (targetFv.period && entryFv.period) {
    periodScore = targetFv.period === entryFv.period ? 100 : calculatePeriodSimilarity(targetFv.period, entryFv.period);
  }
  dimensionScores.push({
    dimension: 'period',
    score: periodScore,
    weight: weights.periodWeight,
    normalizedScore: periodScore * weights.periodWeight,
    description: periodScore > 80 ? `年代匹配：${targetFv.period}` : periodScore > 0 ? `年代相近：${targetFv.period} vs ${entryFv.period}` : '年代不匹配或信息不足',
  });

  let stratigraphyScore = 0;
  if (targetFv.layerNumber && entryFv.layerNumber) {
    stratigraphyScore = targetFv.layerNumber === entryFv.layerNumber ? 100 : calculateLayerSimilarity(targetFv.layerNumber, entryFv.layerNumber);
  }
  dimensionScores.push({
    dimension: 'stratigraphy',
    score: stratigraphyScore,
    weight: weights.stratigraphyWeight,
    normalizedScore: stratigraphyScore * weights.stratigraphyWeight,
    description: stratigraphyScore > 0 ? `地层相关：层位${targetFv.layerNumber} vs ${entryFv.layerNumber}` : '地层信息不足',
  });

  let patternScore = 0;
  if (targetFv.patternStyle && entryFv.patternStyle) {
    patternScore = targetFv.patternStyle === entryFv.patternStyle ? 100 : 30;
  }
  dimensionScores.push({
    dimension: 'pattern',
    score: patternScore,
    weight: weights.patternWeight,
    normalizedScore: patternScore * weights.patternWeight,
    description: patternScore > 0 ? `纹饰${patternScore === 100 ? '完全匹配' : '风格相近'}：${PATTERN_STYLE_LABELS[targetFv.patternStyle!]}` : '纹饰信息不足',
  });

  let thicknessScore = 0;
  if (targetFv.thickness !== null && entryFv.thickness !== null) {
    const diff = Math.abs(targetFv.thickness - entryFv.thickness);
    thicknessScore = Math.max(0, 100 - diff * 20);
  }
  dimensionScores.push({
    dimension: 'thickness',
    score: thicknessScore,
    weight: weights.thicknessWeight,
    normalizedScore: thicknessScore * weights.thicknessWeight,
    description: thicknessScore > 60 ? `厚度相近：${targetFv.thickness}mm vs ${entryFv.thickness}mm` : '厚度差异较大或信息不足',
  });

  let rimCurvatureScore = 0;
  if (targetFv.rimCurvature && entryFv.rimCurvature) {
    rimCurvatureScore = calculateRimCurvatureSimilarity(targetFv.rimCurvature, entryFv.rimCurvature);
  }
  dimensionScores.push({
    dimension: 'rimCurvature',
    score: rimCurvatureScore,
    weight: weights.rimCurvatureWeight,
    normalizedScore: rimCurvatureScore * weights.rimCurvatureWeight,
    description: rimCurvatureScore > 60 ? `口沿曲率${rimCurvatureScore === 100 ? '完全匹配' : '相近'}：${RIM_CURVATURE_LABELS[targetFv.rimCurvature!]}` : '口沿曲率差异较大或信息不足',
  });

  let sizeScore = 0;
  if (targetFv.estimatedRimDiameter !== null && entryFv.estimatedRimDiameter !== null &&
      targetFv.estimatedHeight !== null && entryFv.estimatedHeight !== null) {
    const diameterDiff = Math.abs(targetFv.estimatedRimDiameter - entryFv.estimatedRimDiameter);
    const heightDiff = Math.abs(targetFv.estimatedHeight - entryFv.estimatedHeight);
    const diameterScore = Math.max(0, 100 - diameterDiff);
    const heightScore = Math.max(0, 100 - heightDiff);
    sizeScore = (diameterScore + heightScore) / 2;
  }
  dimensionScores.push({
    dimension: 'size',
    score: sizeScore,
    weight: weights.sizeWeight,
    normalizedScore: sizeScore * weights.sizeWeight,
    description: sizeScore > 60 ? `尺寸相近：口径 ${targetFv.estimatedRimDiameter}cm, 器高 ${targetFv.estimatedHeight}cm` : '尺寸差异较大或信息不足',
  });

  const overall = dimensionScores.reduce((sum, d) => sum + d.normalizedScore, 0);

  return { overall, dimensionScores };
}

function calculatePeriodSimilarity(p1: string, p2: string): number {
  const periodOrder = ['新石器时代', '夏', '商', '西周', '东周', '春秋', '战国', '秦', '汉', '魏晋', '南北朝', '隋', '唐', '宋', '元', '明', '清'];
  const idx1 = periodOrder.indexOf(p1);
  const idx2 = periodOrder.indexOf(p2);
  if (idx1 === -1 || idx2 === -1) return 0;
  const diff = Math.abs(idx1 - idx2);
  return Math.max(0, 100 - diff * 25);
}

function calculateLayerSimilarity(l1: string, l2: string): number {
  const num1 = parseFloat(l1.replace(/[^0-9.]/g, '')) || 0;
  const num2 = parseFloat(l2.replace(/[^0-9.]/g, '')) || 0;
  if (num1 === 0 || num2 === 0) return 50;
  const diff = Math.abs(num1 - num2);
  return Math.max(0, 100 - diff * 30);
}

function calculateRimCurvatureSimilarity(r1: RimCurvature, r2: RimCurvature): number {
  const order: RimCurvature[] = ['strongly_inward', 'slightly_inward', 'straight', 'slightly_outward', 'flared', 'strongly_outward'];
  const idx1 = order.indexOf(r1);
  const idx2 = order.indexOf(r2);
  const diff = Math.abs(idx1 - idx2);
  if (diff === 0) return 100;
  if (diff === 1) return 70;
  if (diff === 2) return 40;
  return 10;
}

export function findSimilarEntries(
  targetFv: SherdFeatureVector,
  targetId: string,
  targetType: 'current_sherd' | 'current_scheme',
  knowledgeBase: KnowledgeBaseEntry[],
  weights?: FeatureWeightConfig,
  topN: number = 10
): SimilarityMatchResult[] {
  const results: SimilarityMatchResult[] = knowledgeBase.map((entry) => {
    const { overall, dimensionScores } = calculateSimilarity(targetFv, entry.featureVector, weights);
    const matchingFeatures = dimensionScores.filter((d) => d.score >= 70).map((d) => d.description);
    const differingFeatures = dimensionScores.filter((d) => d.score > 0 && d.score < 50).map((d) => d.description);

    return {
      targetId,
      targetType,
      matchedEntryId: entry.id,
      matchedEntry: entry,
      overallSimilarity: overall,
      dimensionScores,
      matchingFeatures,
      differingFeatures,
      matchedAt: Date.now(),
    };
  });

  return results.sort((a, b) => b.overallSimilarity - a.overallSimilarity).slice(0, topN);
}

export function generateRecommendations(
  targetFv: SherdFeatureVector,
  targetId: string,
  targetType: 'current_sherd' | 'current_scheme',
  knowledgeBase: KnowledgeBaseEntry[],
  weights?: FeatureWeightConfig
): RecommendationResult[] {
  const similarEntries = findSimilarEntries(targetFv, targetId, targetType, knowledgeBase, weights, 20);

  const recommendations: RecommendationResult[] = [];

  const schemeEntries = similarEntries.filter((e) => e.matchedEntry.entryType === 'scheme');
  if (schemeEntries.length > 0) {
    const topScheme = schemeEntries[0];
    recommendations.push(createRecommendation(
      topScheme,
      'reconstruction_scheme',
      targetId,
      targetType
    ));
  }

  const sherdEntries = similarEntries.filter((e) => e.matchedEntry.entryType === 'sherd');
  if (sherdEntries.length > 0) {
    const topSherd = sherdEntries[0];
    recommendations.push(createRecommendation(
      topSherd,
      'reference_artifact',
      targetId,
      targetType
    ));
  }

  const evidenceEntries = similarEntries.filter((e) => e.matchedEntry.entryType === 'evidence_chain');
  if (evidenceEntries.length > 0) {
    const topEvidence = evidenceEntries[0];
    recommendations.push(createRecommendation(
      topEvidence,
      'evidence_combination',
      targetId,
      targetType
    ));
  }

  const expertEntries = similarEntries.filter((e) => 
    e.matchedEntry.entryType === 'scheme' && 
    e.matchedEntry.schemeEvidence?.expertOpinions &&
    e.matchedEntry.schemeEvidence.expertOpinions.length > 0
  );
  if (expertEntries.length > 0) {
    const topExpert = expertEntries[0];
    recommendations.push(createRecommendation(
      topExpert,
      'expert_opinion',
      targetId,
      targetType
    ));
  }

  return recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
}

function createRecommendation(
  match: SimilarityMatchResult,
  type: RecommendationResult['recommendationType'],
  targetId: string,
  targetType: 'current_sherd' | 'current_scheme'
): RecommendationResult {
  const reasons = generateRecommendationReasons(match, type);
  const confidence = determineConfidenceLevel(match.overallSimilarity);
  const citations = generateEvidenceCitations(match.matchedEntry);

  return {
    id: generateId(),
    recommendationType: type,
    targetId,
    targetType,
    recommendedEntryId: match.matchedEntry.id,
    recommendedEntry: match.matchedEntry,
    recommendationScore: match.overallSimilarity,
    confidenceLevel: confidence,
    recommendationReasons: reasons,
    detailedExplanation: generateDetailedExplanation(match, type, reasons),
    similarityScores: match.dimensionScores,
    evidenceCitations: citations,
    supportingEntries: match.matchingFeatures.slice(0, 5).map((f, i) => ({
      entryId: `${match.matchedEntry.id}-support-${i}`,
      entryTitle: f,
      sourceProjectName: match.matchedEntry.sourceProjectName,
      relevance: 80 - i * 10,
    })),
    generatedAt: Date.now(),
    isApplied: false,
  };
}

function generateRecommendationReasons(match: SimilarityMatchResult, _type: string): string[] {
  const reasons: string[] = [];
  const topDimensions = [...match.dimensionScores].sort((a, b) => b.normalizedScore - a.normalizedScore).slice(0, 3);

  topDimensions.forEach((d) => {
    if (d.score >= 70) {
      reasons.push(d.description);
    }
  });

  if (match.matchedEntry.isTrusted) {
    reasons.push('该条目已被标记为可信，具有较高的参考价值');
  }

  if (match.matchedEntry.referenceCount > 5) {
    reasons.push(`该条目已被引用 ${match.matchedEntry.referenceCount} 次，广受认可`);
  }

  if (reasons.length === 0) {
    reasons.push('基于多维度特征比对，该条目具有一定的参考价值');
  }

  return reasons;
}

function generateDetailedExplanation(match: SimilarityMatchResult, type: string, reasons: string[]): string {
  const typeLabels: Record<string, string> = {
    reconstruction_scheme: '复原方案',
    reference_artifact: '参考器物',
    evidence_combination: '证据组合',
    expert_opinion: '专家意见',
  };

  let explanation = `基于多维度特征比对分析，为您推荐以下${typeLabels[type] || '参考资料'}：\n\n`;
  explanation += `推荐条目：${match.matchedEntry.title}\n`;
  explanation += `来源项目：${match.matchedEntry.sourceProjectName}\n`;
  explanation += `综合相似度：${match.overallSimilarity.toFixed(1)}%\n\n`;

  explanation += '匹配特征分析：\n';
  match.dimensionScores.forEach((d) => {
    const stars = '★'.repeat(Math.round(d.score / 20)) + '☆'.repeat(5 - Math.round(d.score / 20));
    explanation += `  ${stars} ${d.description} (${d.score.toFixed(0)}%)\n`;
  });

  if (reasons.length > 0) {
    explanation += '\n推荐理由：\n';
    reasons.forEach((r, i) => {
      explanation += `  ${i + 1}. ${r}\n`;
    });
  }

  if (match.differingFeatures.length > 0) {
    explanation += '\n注意事项：\n';
    match.differingFeatures.forEach((d, i) => {
      explanation += `  ${i + 1}. ${d}\n`;
    });
  }

  return explanation;
}

function generateEvidenceCitations(entry: KnowledgeBaseEntry): EvidenceCitation[] {
  const citations: EvidenceCitation[] = [];

  if (entry.schemeEvidence) {
    entry.schemeEvidence.evidenceSources.forEach((es) => {
      citations.push({
        id: generateId(),
        entryId: entry.id,
        entryTitle: entry.title,
        sourceProjectName: entry.sourceProjectName,
        evidenceType: es.type,
        description: es.title,
        relevance: 90,
        pageReference: es.pageReference,
        url: es.url,
      });
    });

    entry.schemeEvidence.referenceArtifacts.forEach((ra) => {
      citations.push({
        id: generateId(),
        entryId: entry.id,
        entryTitle: entry.title,
        sourceProjectName: entry.sourceProjectName,
        evidenceType: 'typology',
        description: `参考器物：${ra.artifactName} (${ra.artifactType})`,
        relevance: ra.similarityScore,
      });
    });

    entry.schemeEvidence.expertOpinions.forEach((eo) => {
      citations.push({
        id: generateId(),
        entryId: entry.id,
        entryTitle: entry.title,
        sourceProjectName: entry.sourceProjectName,
        evidenceType: 'expert',
        description: `${eo.expertName} (${eo.expertTitle || '专家'})：${eo.content}`,
        relevance: 85,
      });
    });
  }

  return citations.slice(0, 10);
}

function determineConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 85) return 'very_high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function searchKnowledgeBase(
  knowledgeBase: KnowledgeBaseEntry[],
  filter: KnowledgeBaseSearchFilter
): KnowledgeBaseSearchResult {
  let results = [...knowledgeBase];

  if (filter.keyword) {
    const keyword = filter.keyword.toLowerCase();
    results = results.filter((entry) =>
      entry.title.toLowerCase().includes(keyword) ||
      entry.description.toLowerCase().includes(keyword) ||
      entry.tags.some((t) => t.toLowerCase().includes(keyword))
    );
  }

  if (filter.artifactTypes && filter.artifactTypes.length > 0) {
    results = results.filter((e) => e.featureVector.artifactType && filter.artifactTypes!.includes(e.featureVector.artifactType));
  }

  if (filter.periods && filter.periods.length > 0) {
    results = results.filter((e) => e.featureVector.period && filter.periods!.includes(e.featureVector.period));
  }

  if (filter.layerNumbers && filter.layerNumbers.length > 0) {
    results = results.filter((e) => e.featureVector.layerNumber && filter.layerNumbers!.includes(e.featureVector.layerNumber));
  }

  if (filter.patternStyles && filter.patternStyles.length > 0) {
    results = results.filter((e) => e.featureVector.patternStyle && filter.patternStyles!.includes(e.featureVector.patternStyle));
  }

  if (filter.thicknessRange) {
    results = results.filter((e) => {
      if (e.featureVector.thickness === null) return false;
      return e.featureVector.thickness >= filter.thicknessRange!.min && e.featureVector.thickness <= filter.thicknessRange!.max;
    });
  }

  if (filter.rimCurvatures && filter.rimCurvatures.length > 0) {
    results = results.filter((e) => e.featureVector.rimCurvature && filter.rimCurvatures!.includes(e.featureVector.rimCurvature));
  }

  if (filter.entryTypes && filter.entryTypes.length > 0) {
    results = results.filter((e) => filter.entryTypes!.includes(e.entryType));
  }

  if (filter.sourceProjectIds && filter.sourceProjectIds.length > 0) {
    results = results.filter((e) => filter.sourceProjectIds!.includes(e.sourceProjectId));
  }

  if (filter.isTrustedOnly) {
    results = results.filter((e) => e.isTrusted);
  }

  if (filter.dateRange) {
    results = results.filter((e) => e.createdAt >= filter.dateRange!.start && e.createdAt <= filter.dateRange!.end);
  }

  const sortBy = filter.sortBy || 'relevance';
  const sortAsc = filter.sortAsc || false;

  results.sort((a, b) => {
    let diff = 0;
    switch (sortBy) {
      case 'date':
        diff = a.createdAt - b.createdAt;
        break;
      case 'viewCount':
        diff = a.viewCount - b.viewCount;
        break;
      case 'referenceCount':
        diff = a.referenceCount - b.referenceCount;
        break;
      case 'relevance':
      default:
        diff = 0;
    }
    return sortAsc ? diff : -diff;
  });

  const stats = calculateStats(knowledgeBase);

  const page = filter.page || 1;
  const pageSize = filter.pageSize || 20;
  const start = (page - 1) * pageSize;
  const paginated = results.slice(start, start + pageSize);

  return {
    entries: paginated,
    total: results.length,
    page,
    pageSize,
    stats,
  };
}

export function calculateStats(knowledgeBase: KnowledgeBaseEntry[]): KnowledgeBaseStats {
  const artifactTypeDistribution = {} as Record<ArtifactType, number>;
  const periodDistribution: Record<string, number> = {};
  const patternStyleDistribution = {} as Record<PatternStyle, number>;

  const projectIds = new Set<string>();

  let sherdCount = 0;
  let schemeCount = 0;
  let reportCount = 0;
  let evidenceChainCount = 0;
  let trustedEntryCount = 0;
  let totalViewCount = 0;
  let totalReferenceCount = 0;

  knowledgeBase.forEach((entry) => {
    projectIds.add(entry.sourceProjectId);

    switch (entry.entryType) {
      case 'sherd':
        sherdCount++;
        break;
      case 'scheme':
        schemeCount++;
        break;
      case 'report':
        reportCount++;
        break;
      case 'evidence_chain':
        evidenceChainCount++;
        break;
    }

    if (entry.isTrusted) trustedEntryCount++;
    totalViewCount += entry.viewCount;
    totalReferenceCount += entry.referenceCount;

    if (entry.featureVector.artifactType) {
      artifactTypeDistribution[entry.featureVector.artifactType] = (artifactTypeDistribution[entry.featureVector.artifactType] || 0) + 1;
    }
    if (entry.featureVector.period) {
      periodDistribution[entry.featureVector.period] = (periodDistribution[entry.featureVector.period] || 0) + 1;
    }
    if (entry.featureVector.patternStyle) {
      patternStyleDistribution[entry.featureVector.patternStyle] = (patternStyleDistribution[entry.featureVector.patternStyle] || 0) + 1;
    }
  });

  return {
    totalEntries: knowledgeBase.length,
    sherdCount,
    schemeCount,
    reportCount,
    evidenceChainCount,
    projectCount: projectIds.size,
    artifactTypeDistribution,
    periodDistribution,
    patternStyleDistribution,
    trustedEntryCount,
    totalViewCount,
    totalReferenceCount,
    lastUpdated: Date.now(),
  };
}

export function importProjectToKnowledgeBase(
  project: ProjectData,
  existingKnowledgeBase: KnowledgeBaseEntry[],
  getSherdEvidence: (sherdId: string) => SherdEvidence,
  getSchemeEvidence: (schemeId: string) => SchemeEvidence,
  getSchemeMetrics: (schemeId: string) => ReconstructionMetrics | null,
  getGeneratedReports: () => ReconstructionReport[]
): { entries: KnowledgeBaseEntry[]; importedCount: number; skippedCount: number } {
  const newEntries: KnowledgeBaseEntry[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  const projectId = `${project.name}-${project.createdAt}`;
  const existingProjectEntries = existingKnowledgeBase.filter((e) => e.sourceProjectId === projectId);

  project.sherds.forEach((sherd) => {
    const exists = existingProjectEntries.some((e) => e.entryType === 'sherd' && e.sherd?.id === sherd.id);
    if (exists) {
      skippedCount++;
      return;
    }
    const sherdEvidence = getSherdEvidence(sherd.id);
    const entry = createSherdEntry(sherd, sherdEvidence, project);
    newEntries.push(entry);
    importedCount++;
  });

  project.schemes.forEach((scheme) => {
    const exists = existingProjectEntries.some((e) => e.entryType === 'scheme' && e.scheme?.id === scheme.id);
    if (exists) {
      skippedCount++;
      return;
    }
    const schemeEvidence = getSchemeEvidence(scheme.id);
    const metrics = getSchemeMetrics(scheme.id) || undefined;
    const entry = createSchemeEntry(scheme, schemeEvidence, project, metrics);
    newEntries.push(entry);
    importedCount++;

    const chainExists = existingProjectEntries.some((e) => e.entryType === 'evidence_chain' && e.scheme?.id === scheme.id);
    if (!chainExists && (schemeEvidence.evidenceSources.length > 0 || schemeEvidence.chronologyJudgments.length > 0)) {
      const chainEntry = createEvidenceChainEntry(scheme.id, 'scheme', schemeEvidence, project);
      newEntries.push(chainEntry);
      importedCount++;
    }
  });

  const reports = getGeneratedReports();
  reports.forEach((report) => {
    const exists = existingProjectEntries.some((e) => e.entryType === 'report' && e.report?.id === report.id);
    if (exists) {
      skippedCount++;
      return;
    }
    const entry = createReportEntry(report, project);
    newEntries.push(entry);
    importedCount++;
  });

  return { entries: newEntries, importedCount, skippedCount };
}
