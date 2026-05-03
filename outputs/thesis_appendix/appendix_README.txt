These exports are appendix material for thesis auditability.
Rankings are exported from existing ranking data and are not recomputed.
planned_any_2026 final configurations: Top-35 = DecisionTree + rerank_population_focus; Top-70 = RandomForest + grid_0005; Top-105 = RandomForest + rerank_medium.
The exact planned_any_2026 final ranking configurations are stored in refined_recall_max_any2026 from recall_maximizer_any2026_policyboost.xlsx, sheet all_rankings_top160.
Because that source is truncated to Top-160 rows, the planned_any appendix ranking exports contain 160 rows each, not the full 350-road universe.
A separate 350-row refined_rerank_any2026 source exists, but it only provides score_type = rerank and is not the same as the requested planned_any final configurations, so it is not substituted here.
planned_teknokratis_2026 final configurations: Top-35 = XGBoost + rerank; Top-70 = DecisionTree + rerank; Top-105 = DecisionTree + rerank.
normatif_17 AHP_WSM is the main normative appendix ranking.
normatif_20 AHP_WSM is optional sensitivity if available.
Target lists are labels/annotations, not ranking overlap calculations.