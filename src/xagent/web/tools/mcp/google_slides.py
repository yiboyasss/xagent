import json
import logging
import os
import re
import uuid
from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build  # type: ignore[import-not-found]
from mcp.server.fastmcp import FastMCP

from .utils import resolve_id_from_url, setup_proxy_env

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("google-slides-mcp")

# Ensure standard proxy environment variables are set to prevent hanging requests
setup_proxy_env()

mcp = FastMCP("google-slides-mcp")

_PRESENTATION_URL_ID_PATTERN = re.compile(r"/presentation/d/([a-zA-Z0-9_-]+)")

# Predefined layouts we know how to fill in, mapped to the (title_placeholder,
# body_placeholder) types Slides creates for each one. `None` means that slot
# doesn't exist on the layout at all.
#
# Deliberately limited to the layouts whose placeholder composition is well
# established (matching Google's official Apps Script PredefinedLayout docs
# and this file's pre-existing TITLE_AND_BODY mapping). Google's docs
# explicitly warn a predefined layout's placeholder set "may have been
# changed" and don't enumerate it for every layout, so less-common ones
# (SECTION_TITLE_AND_DESCRIPTION, ONE_COLUMN_TEXT, MAIN_POINT, BIG_NUMBER)
# are intentionally left out rather than guessed at — use
# google_slides_batch_update for those until verified against a live API.
_LAYOUT_PLACEHOLDERS: dict[str, tuple[str | None, str | None]] = {
    "TITLE": ("CENTERED_TITLE", "SUBTITLE"),
    "TITLE_AND_BODY": ("TITLE", "BODY"),
    "TITLE_ONLY": ("TITLE", None),
    "SECTION_HEADER": ("TITLE", None),
    "BLANK": (None, None),
}

_BULLET_PREFIX_PATTERN = re.compile(r"^[ \t]*[•\-\*][ \t]+")


def _strip_bullet_prefixes(text: str) -> str:
    """Drop a leading "•"/"-"/"*" marker from each line.

    Callers pass body text with literal bullet glyphs; once we ask Slides to
    render real bulleted paragraphs (see createParagraphBullets below) those
    glyphs would double up with Slides' own bullet, so strip them first.
    """
    return "\n".join(_BULLET_PREFIX_PATTERN.sub("", line) for line in text.split("\n"))


def _error(message: str) -> str:
    return json.dumps({"status": "error", "message": message})


def _body_insert_requests(
    body_id: str, body: str, is_bulleted: bool
) -> list[dict[str, Any]]:
    """insertText for `body_id`, plus createParagraphBullets when the target
    placeholder is a real bulleted-list BODY (not e.g. a plain SUBTITLE)."""
    requests: list[dict[str, Any]] = [
        {
            "insertText": {
                "objectId": body_id,
                "text": _strip_bullet_prefixes(body) if is_bulleted else body,
            }
        }
    ]
    if is_bulleted:
        requests.append(
            {
                "createParagraphBullets": {
                    "objectId": body_id,
                    "textRange": {"type": "ALL"},
                    "bulletPreset": "BULLET_DISC_CIRCLE_SQUARE",
                }
            }
        )
    return requests


# Placeholder types that fill the "title" vs "body" role of a slide, used to
# locate an existing slide's placeholders by type when editing it (as
# opposed to _LAYOUT_PLACEHOLDERS above, which picks placeholder types when
# *creating* a slide from a predefined layout).
_TITLE_PLACEHOLDER_TYPES = {"TITLE", "CENTERED_TITLE"}
_BODY_PLACEHOLDER_TYPES = {"BODY", "SUBTITLE"}


def _find_slide(presentation: dict[str, Any], slide_id: str) -> dict[str, Any] | None:
    slides: list[dict[str, Any]] = presentation.get("slides", [])
    for slide in slides:
        if slide.get("objectId") == slide_id:
            return slide
    return None


def _find_placeholders(
    slide: dict[str, Any],
) -> dict[str, tuple[dict[str, Any], str]]:
    """Map "title"/"body" to (element, placeholder_type) for a slide's
    shapes, so callers can target the right shape without knowing the
    layout-specific ids assigned when the slide was created.

    If a slide has more than one placeholder of the same role (not
    reachable via this file's own google_slides_add_slide, which only ever
    creates one of each, but possible for a slide created some other way),
    only the first one encountered is kept — there's no way to disambiguate
    further from the role alone.
    """
    found: dict[str, tuple[dict[str, Any], str]] = {}
    for element in slide.get("pageElements", []):
        placeholder = element.get("shape", {}).get("placeholder")
        if not placeholder:
            continue
        placeholder_type = placeholder.get("type", "")
        if placeholder_type in _TITLE_PLACEHOLDER_TYPES:
            found.setdefault("title", (element, placeholder_type))
        elif placeholder_type in _BODY_PLACEHOLDER_TYPES:
            found.setdefault("body", (element, placeholder_type))
    return found


def get_slides_service() -> Any:
    token = os.environ.get("GOOGLE_ACCESS_TOKEN")
    refresh_token = os.environ.get("GOOGLE_REFRESH_TOKEN")
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")

    if not token:
        raise ValueError("GOOGLE_ACCESS_TOKEN environment variable is missing")

    creds_kwargs = {"token": token}
    if refresh_token and client_id and client_secret:
        creds_kwargs.update(
            {
                "refresh_token": refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )

    credentials = Credentials(**creds_kwargs)
    return build("slides", "v1", credentials=credentials)


def _resolve_presentation_id(presentation_id: str) -> str:
    """Accept either a bare presentation id or a full Google Slides URL."""
    return resolve_id_from_url(
        presentation_id, _PRESENTATION_URL_ID_PATTERN, "presentation_id"
    )


def _element_text(element: dict[str, Any]) -> str:
    text_elements = element.get("shape", {}).get("text", {}).get("textElements", [])
    return "".join(
        text_element.get("textRun", {}).get("content", "")
        for text_element in text_elements
    )


def _slide_summary(slide: dict[str, Any], index: int) -> dict[str, Any]:
    texts = [
        text
        for element in slide.get("pageElements", [])
        if (text := _element_text(element).strip())
    ]
    return {
        "slide_number": index + 1,
        "object_id": slide.get("objectId"),
        "text": texts,
    }


@mcp.tool()
def google_slides_get_presentation(presentation_id: str) -> str:
    """
    Read a Google Slides presentation by id or full URL.
    Returns the title and the text content of each slide.
    """
    try:
        pres_id = _resolve_presentation_id(presentation_id)
        service = get_slides_service()
        presentation = service.presentations().get(presentationId=pres_id).execute()

        slides = [
            _slide_summary(slide, index)
            for index, slide in enumerate(presentation.get("slides", []))
        ]
        return json.dumps(
            {
                "status": "success",
                "presentation_id": presentation.get("presentationId"),
                "title": presentation.get("title"),
                "slide_count": len(slides),
                "slides": slides,
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.error(f"Error getting presentation: {e}")
        return json.dumps({"status": "error", "message": str(e)})


@mcp.tool()
def google_slides_create_presentation(title: str) -> str:
    """
    Create a new, empty Google Slides presentation with the given title.
    Use google_slides_add_slide to add content slides afterwards.
    """
    try:
        service = get_slides_service()
        presentation = service.presentations().create(body={"title": title}).execute()
        pres_id = presentation.get("presentationId")

        return json.dumps(
            {
                "status": "success",
                "presentation_id": pres_id,
                "title": presentation.get("title"),
                "link": f"https://docs.google.com/presentation/d/{pres_id}/edit",
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.error(f"Error creating presentation: {e}")
        return json.dumps({"status": "error", "message": str(e)})


@mcp.tool()
def google_slides_add_slide(
    presentation_id: str,
    title: str = "",
    body: str = "",
    layout: str = "TITLE_AND_BODY",
) -> str:
    """
    Append a slide with a title and body text to a Google Slides presentation.
    The body supports plain text; use newlines to separate bullet lines — each
    line is rendered as its own bulleted paragraph (don't type literal "•"/"-"
    markers, Slides adds the bullet glyph itself).

    layout picks the slide's predefined layout, which decides which of
    title/body actually have a placeholder to land in:
      - "TITLE_AND_BODY" (default): title + full bulleted body content.
      - "TITLE": a cover/section-opening slide — title is the big centered
        title, body (optional) becomes the subtitle line (not bulleted).
      - "TITLE_ONLY", "SECTION_HEADER": title only, no body placeholder —
        pass body="" or the call is rejected.
      - "BLANK": no placeholders at all; use google_slides_batch_update to
        add free-form text boxes/images instead.

    To fix a slide this call already created (wrong/missing text), use
    google_slides_update_slide with its slide_id — do NOT call
    google_slides_add_slide again, that creates a second, duplicate slide
    rather than editing the first one.

    After adding all the slides for a deck, call
    google_slides_get_presentation once to read back every slide's actual
    title/body text and confirm it matches what you intended (e.g. against
    the user's outline) before telling the user the deck is done.
    """
    try:
        if layout not in _LAYOUT_PLACEHOLDERS:
            return _error(
                f"Unknown layout '{layout}'. Supported layouts: "
                f"{', '.join(sorted(_LAYOUT_PLACEHOLDERS))}"
            )

        title_placeholder, body_placeholder = _LAYOUT_PLACEHOLDERS[layout]

        if title and title_placeholder is None:
            return _error(
                f"layout '{layout}' has no title placeholder, so "
                "'title' would be silently dropped. Use a different "
                "layout, or google_slides_batch_update for a custom "
                "text box."
            )
        if body and body_placeholder is None:
            return _error(
                f"layout '{layout}' has no body placeholder, so "
                "'body' would be silently dropped. Use a layout "
                "with a body/subtitle placeholder (e.g. "
                "TITLE_AND_BODY, TITLE) or omit body."
            )
        if not body.strip() and body_placeholder == "BODY":
            return _error(
                f"layout '{layout}' expects body content but none "
                "was provided. Include this slide's full bullet/"
                "detail text in 'body' — don't create the slide "
                "with just a title."
            )

        pres_id = _resolve_presentation_id(presentation_id)
        service = get_slides_service()

        slide_id = f"slide_{uuid.uuid4().hex[:12]}"
        title_id = f"{slide_id}_title"
        body_id = f"{slide_id}_body"

        placeholder_mappings: list[dict[str, Any]] = []
        if title_placeholder is not None:
            placeholder_mappings.append(
                {
                    "layoutPlaceholder": {"type": title_placeholder},
                    "objectId": title_id,
                }
            )
        if body_placeholder is not None:
            placeholder_mappings.append(
                {
                    "layoutPlaceholder": {"type": body_placeholder},
                    "objectId": body_id,
                }
            )

        requests: list[dict[str, Any]] = [
            {
                "createSlide": {
                    "objectId": slide_id,
                    "slideLayoutReference": {"predefinedLayout": layout},
                    "placeholderIdMappings": placeholder_mappings,
                }
            }
        ]
        if title:
            requests.append({"insertText": {"objectId": title_id, "text": title}})
        if body:
            requests.extend(
                _body_insert_requests(body_id, body, body_placeholder == "BODY")
            )

        service.presentations().batchUpdate(
            presentationId=pres_id, body={"requests": requests}
        ).execute()

        return json.dumps(
            {
                "status": "success",
                "presentation_id": pres_id,
                "slide_id": slide_id,
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.error(f"Error adding slide: {e}")
        return _error(str(e))


@mcp.tool()
def google_slides_update_slide(
    presentation_id: str, slide_id: str, title: str = "", body: str = ""
) -> str:
    """
    Replace the title and/or body text of an existing slide (identified by
    the slide_id a prior google_slides_add_slide call returned), instead of
    creating a new one. Use this to fix a slide that came out wrong or
    incomplete — calling google_slides_add_slide again does NOT edit that
    slide, it creates a duplicate one next to it.

    Only the placeholders you pass non-empty text for are touched; omit
    title or body to leave that placeholder untouched. Body text follows
    the same rule as google_slides_add_slide: newline-separated lines
    become bulleted paragraphs when the slide's body placeholder is a real
    "BODY" type (not a plain "SUBTITLE").
    """
    try:
        if not title and not body:
            return _error("Provide at least one of 'title' or 'body' to update.")
        if title and not title.strip():
            return _error("'title' is whitespace-only; provide real text or omit it.")
        if body and not body.strip():
            return _error("'body' is whitespace-only; provide real text or omit it.")

        pres_id = _resolve_presentation_id(presentation_id)
        service = get_slides_service()
        presentation = service.presentations().get(presentationId=pres_id).execute()

        slide = _find_slide(presentation, slide_id)
        if slide is None:
            return _error(f"No slide with id '{slide_id}' in this presentation.")

        placeholders = _find_placeholders(slide)

        if title and "title" not in placeholders:
            return _error(
                f"Slide '{slide_id}' has no title placeholder, so 'title' "
                "has nowhere to go."
            )
        if body and "body" not in placeholders:
            return _error(
                f"Slide '{slide_id}' has no body/subtitle placeholder, so "
                "'body' has nowhere to go."
            )

        requests: list[dict[str, Any]] = []
        for role, text in (("title", title), ("body", body)):
            if not text:
                continue
            element, placeholder_type = placeholders[role]
            object_id = element["objectId"]
            if _element_text(element):
                requests.append(
                    {
                        "deleteText": {
                            "objectId": object_id,
                            "textRange": {"type": "ALL"},
                        }
                    }
                )
            if role == "title":
                requests.append({"insertText": {"objectId": object_id, "text": text}})
            else:
                requests.extend(
                    _body_insert_requests(object_id, text, placeholder_type == "BODY")
                )

        service.presentations().batchUpdate(
            presentationId=pres_id, body={"requests": requests}
        ).execute()

        return json.dumps(
            {
                "status": "success",
                "presentation_id": pres_id,
                "slide_id": slide_id,
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.error(f"Error updating slide: {e}")
        return _error(str(e))


@mcp.tool()
def google_slides_delete_slide(presentation_id: str, slide_id: str) -> str:
    """
    Permanently delete one slide from a presentation by its slide_id.
    Use this to remove a duplicate or wrong slide — for example one created
    by calling google_slides_add_slide a second time instead of using
    google_slides_update_slide to fix the original.
    """
    try:
        pres_id = _resolve_presentation_id(presentation_id)
        service = get_slides_service()
        presentation = service.presentations().get(presentationId=pres_id).execute()

        if _find_slide(presentation, slide_id) is None:
            return _error(
                f"No slide with id '{slide_id}' in this presentation — "
                "refusing to delete. Make sure this is a slide id, not a "
                "placeholder shape id (e.g. one ending in '_title'/'_body')."
            )

        service.presentations().batchUpdate(
            presentationId=pres_id,
            body={"requests": [{"deleteObject": {"objectId": slide_id}}]},
        ).execute()

        return json.dumps(
            {
                "status": "success",
                "presentation_id": pres_id,
                "slide_id": slide_id,
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.error(f"Error deleting slide: {e}")
        return _error(str(e))


@mcp.tool()
def google_slides_batch_update(presentation_id: str, requests_json: str) -> str:
    """
    Advanced: apply raw Google Slides API batchUpdate requests to a presentation.
    requests_json must be a JSON array of request objects following the Slides API
    schema (e.g. createShape, insertText, updateTextStyle, createImage).
    Use this only when the simpler tools cannot express the required change.
    """
    try:
        pres_id = _resolve_presentation_id(presentation_id)
        requests = json.loads(requests_json)
        if not isinstance(requests, list):
            raise ValueError("requests_json must be a JSON array of request objects")

        service = get_slides_service()
        result = (
            service.presentations()
            .batchUpdate(presentationId=pres_id, body={"requests": requests})
            .execute()
        )

        return json.dumps(
            {
                "status": "success",
                "presentation_id": result.get("presentationId", pres_id),
                "replies": result.get("replies", []),
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.error(f"Error applying batch update: {e}")
        return json.dumps({"status": "error", "message": str(e)})


if __name__ == "__main__":
    mcp.run()
