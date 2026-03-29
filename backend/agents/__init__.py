"""
EventOS Agent Registry — Maps intent strings to async agent functions.
The Orchestrator uses this to look up which function to call for each intent.
"""

from backend.agents.marketing import image_subagent, video_subagent
from backend.agents.sponsor import web_scraper, tier_matcher
from backend.agents.project_manager import timeline_builder
from backend.agents.communication import discord_subagent, email_subagent
from backend.agents.compliance import rule_extractor
from backend.agents.context import web_researcher
from backend.agents.finance import budget_planner, expense_tracker


AGENT_REGISTRY = {
    # Marketing Factory
    "generate_image":    image_subagent,
    "generate_video":    video_subagent,

    # Sponsor Scout
    "find_sponsors":     web_scraper,
    "match_tiers":       tier_matcher,

    # Project Manager
    "build_timeline":    timeline_builder,

    # Communication
    "send_discord":      discord_subagent,
    "send_email":        email_subagent,

    # Compliance Shield
    "extract_rules":     rule_extractor,

    # Context Agent
    "research_context":  web_researcher,

    # Finance
    "plan_budget":       budget_planner,
    "track_expense":     expense_tracker,
}
