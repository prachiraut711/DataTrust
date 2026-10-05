from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.schemas.ai import AIKeyIssue, AIQualityExplanation
from app.services.anomaly.anomaly_service import anomaly_service
from app.services.datasets.dataset_service import dataset_service
from app.services.history.history_service import history_service
from app.services.profiling.profiling_service import profiling_service
from app.services.quality.quality_service import quality_service
from app.services.reliability.reliability_service import reliability_service

logger = logging.getLogger(__name__)


class GeminiService:
    """Service providing Gemini-powered plain-language data quality and reliability explanations."""

    def build_dataset_context(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """Aggregate statistical and quality metrics across DataTrust engines.

        Strict privacy guarantee: Raw data rows, cell values, and credentials are NEVER
        included in the payload. Only statistical summaries and evaluation results are assembled.
        """
        # 1. Fetch dataset ensuring workspace isolation (raises 404 if inaccessible)
        dataset = dataset_service.get_dataset(db, user, dataset_id)

        # 2. Collect domain metrics from existing calculation engines
        profile = profiling_service.profile_dataset(dataset)
        quality_eval = quality_service.evaluate_dataset(db, user, dataset_id)
        anomaly_res = anomaly_service.detect_anomalies(dataset)
        rel_result = reliability_service.calculate_reliability(db, user, dataset_id)
        recent_runs = history_service.list_runs(db, user, dataset_id, limit=2)

        # 3. Column statistical summaries (sanitized: only metadata and distributions)
        cols_summary = [
            {
                "name": col.column_name,
                "data_type": col.data_type,
                "category": col.inferred_category,
                "null_percentage": col.null_percentage,
                "distinct_count": col.distinct_count,
                "unique_percentage": col.unique_percentage,
            }
            for col in profile.columns
        ]

        # 4. Failing quality rules detail
        failing_rules = [
            {
                "rule_name": r.rule_name,
                "rule_type": r.rule_type,
                "column": r.column_name,
                "failure_percentage": r.failure_percentage,
                "message": r.message,
            }
            for r in quality_eval.results
            if r.status == "FAIL"
        ]

        # 5. Anomalous columns detail
        anomalous_cols = [
            {
                "column": c.column_name,
                "anomaly_count": c.anomaly_count,
                "anomaly_percentage": c.anomaly_percentage,
            }
            for c in anomaly_res.column_results
            if c.status == "success" and c.anomaly_count > 0
        ]

        # 6. Historical trend synopsis
        trend_summary = "Initial analysis run (no historical baseline)."
        if len(recent_runs) >= 2:
            curr_run = recent_runs[0]
            prev_run = recent_runs[1]
            diff = round(curr_run.reliability_score - prev_run.reliability_score, 2)
            if diff > 0:
                trend_summary = (
                    f"Reliability score improved by +{diff} points compared to previous snapshot "
                    f"({prev_run.reliability_score} -> {curr_run.reliability_score})."
                )
            elif diff < 0:
                trend_summary = (
                    f"Reliability score degraded by {diff} points compared to previous snapshot "
                    f"({prev_run.reliability_score} -> {curr_run.reliability_score})."
                )
            else:
                trend_summary = (
                    f"Reliability score remained steady at {curr_run.reliability_score} across consecutive snapshots."
                )
        elif len(recent_runs) == 1:
            trend_summary = f"Single recorded snapshot available (Reliability score: {recent_runs[0].reliability_score})."

        return {
            "dataset_name": dataset.name,
            "file_format": dataset.file_format,
            "total_rows": profile.total_rows,
            "total_columns": profile.total_columns,
            "missing_value_percentage": profile.missing_value_percentage,
            "total_missing_values": profile.total_missing_values,
            "duplicate_rows": profile.duplicate_rows,
            "duplicate_percentage": profile.duplicate_row_percentage,
            "columns_summary": cols_summary,
            "reliability": {
                "score": rel_result.reliability_score,
                "level": rel_result.reliability_level,
                "formula": rel_result.formula,
                "quality_component": {
                    "score": rel_result.components.quality.score,
                    "weight": rel_result.components.quality.weight,
                    "passed_rules": rel_result.components.quality.passed_rules,
                    "failed_rules": rel_result.components.quality.failed_rules,
                    "total_rules": rel_result.components.quality.total_rules,
                    "failing_rules_details": failing_rules,
                },
                "completeness_component": {
                    "score": rel_result.components.completeness.score,
                    "weight": rel_result.components.completeness.weight,
                    "missing_cells": rel_result.components.completeness.missing_cells,
                    "missing_percentage": rel_result.components.completeness.missing_percentage,
                },
                "anomaly_component": {
                    "score": rel_result.components.anomaly_health.score,
                    "weight": rel_result.components.anomaly_health.weight,
                    "total_anomalies": rel_result.components.anomaly_health.total_anomalies,
                    "anomaly_percentage": rel_result.components.anomaly_health.anomaly_percentage,
                    "anomalous_columns": anomalous_cols,
                },
            },
            "history_trend": trend_summary,
        }

    def build_prompt(self, context: Dict[str, Any]) -> str:
        """Construct a structured prompt guiding Gemini to act as a senior data reliability engineer."""
        return (
            "You are DataTrust's Senior Data Reliability and Quality Engineering Assistant.\n"
            "Your task is to analyze the following aggregated dataset quality, completeness, and anomaly metrics "
            "and provide an executive, plain-language assessment for data engineers, analysts, and ML practitioners.\n\n"
            "IMPORTANT RULES:\n"
            "1. Answer clearly:\n"
            "   - What is wrong with this dataset?\n"
            "   - Why is the reliability score at its current level?\n"
            "   - What are the key issues (prioritized by severity: 'high', 'medium', or 'low')?\n"
            "   - What concrete, actionable remediation steps should the data team take?\n"
            "2. Do NOT hallucinate raw dataset values or assume unmentioned columns.\n"
            "3. Focus on explaining the metrics computed by DataTrust.\n"
            "4. Output MUST be strictly valid JSON matching the following structure:\n"
            "{\n"
            '  "summary": "Executive summary paragraph explaining overall dataset health and ML/analytics readiness.",\n'
            '  "key_issues": [\n'
            '    {\n'
            '      "title": "Short descriptive title of the issue",\n'
            '      "explanation": "Clear explanation of the problem, root causes, and analytical impact",\n'
            '      "severity": "high" | "medium" | "low"\n'
            '    }\n'
            '  ],\n'
            '  "recommendations": [\n'
            '    "Actionable step 1",\n'
            '    "Actionable step 2"\n'
            '  ],\n'
            '  "reliability_explanation": "Plain-language breakdown of why the reliability score was assessed at this value based on the 50% Quality, 25% Completeness, and 25% Anomaly Health components."\n'
            "}\n\n"
            f"DATASET ANALYSIS METRICS:\n{json.dumps(context, indent=2)}\n"
        )

    def _parse_gemini_response(self, raw_text: str) -> AIQualityExplanation:
        """Parse and sanitize raw Gemini response into validated AIQualityExplanation model."""
        cleaned = raw_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except Exception as err:
            logger.error("Failed to parse Gemini JSON output: %s. Response: %s", err, raw_text)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI explanation is temporarily unavailable. Please try again.",
            )

        summary = str(data.get("summary", "")).strip() or "Analysis completed successfully."
        rel_exp = (
            str(data.get("reliability_explanation", "")).strip()
            or "Reliability score evaluated from quality checks, completeness, and anomaly health."
        )

        raw_issues = data.get("key_issues", [])
        key_issues: List[AIKeyIssue] = []
        if isinstance(raw_issues, list):
            for item in raw_issues:
                if isinstance(item, dict):
                    sev = str(item.get("severity", "medium")).lower().strip()
                    if sev not in ("high", "medium", "low"):
                        sev = "medium"
                    key_issues.append(
                        AIKeyIssue(
                            title=str(item.get("title", "Data Issue")),
                            explanation=str(item.get("explanation", "")),
                            severity=sev,  # type: ignore[arg-type]
                        )
                    )

        raw_recs = data.get("recommendations", [])
        recommendations: List[str] = []
        if isinstance(raw_recs, list):
            for r in raw_recs:
                if r:
                    recommendations.append(str(r).strip())

        return AIQualityExplanation(
            summary=summary,
            key_issues=key_issues,
            recommendations=recommendations,
            reliability_explanation=rel_exp,
            generated_at=datetime.now(timezone.utc),
        )

    def generate_quality_explanation(
        self,
        summary_context: Dict[str, Any],
    ) -> AIQualityExplanation:
        """Invoke Gemini API to generate explanation from structured statistical summary context."""
        api_key = settings.GEMINI_API_KEY
        if not api_key or not api_key.strip():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI explanation is not configured. Add GEMINI_API_KEY to enable this feature.",
            )

        prompt = self.build_prompt(summary_context)

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key.strip())
            model_name = settings.GEMINI_MODEL or "gemini-2.5-flash"

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            raw_text = response.text or ""
            return self._parse_gemini_response(raw_text)
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Gemini model execution error: %s", str(exc), exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI explanation is temporarily unavailable. Please try again.",
            )

    def explain_dataset(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
    ) -> AIQualityExplanation:
        """Orchestrate end-to-end dataset explanation generation."""
        context = self.build_dataset_context(db, user, dataset_id)
        return self.generate_quality_explanation(context)


gemini_service = GeminiService()
