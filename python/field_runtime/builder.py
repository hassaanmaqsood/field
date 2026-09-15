"""Syntax builder converting Python data structures to the Field Runtime DSL."""

from typing import Dict, List, Optional, Tuple, Union

DomainType = Union[str, Dict[str, Tuple[float, float]], List[Tuple[float, float]]]


def format_domain(domain: Optional[DomainType]) -> str:
    """Format domain specification into `x[min:max] y[min:max] z[min:max]`."""
    if not domain:
        return ""
    if isinstance(domain, str):
        return domain.strip()
    if isinstance(domain, dict):
        parts = []
        for axis in ["x", "y", "z"]:
            if axis in domain:
                lo, hi = domain[axis]
                parts.append(f"{axis}[{lo}:{hi}]")
        return " ".join(parts)
    if isinstance(domain, (list, tuple)):
        axes = ["x", "y", "z"]
        parts = []
        for i, bound in enumerate(domain[:3]):
            lo, hi = bound
            parts.append(f"{axes[i]}[{lo}:{hi}]")
        return " ".join(parts)
    return str(domain)


def build_dsl(
    field_spec: Dict[str, str],
    ops_list: List[str],
    view_layers: List[str],
    sample_spec: Dict[str, str],
) -> str:
    """Compile the component blocks into the unified Field Runtime syntax."""
    blocks: List[str] = []

    # 1. field { ... }
    field_lines = []
    if "preset" in field_spec:
        field_lines.append(f"  preset: {field_spec['preset']}")
    if "expr" in field_spec:
        expr = field_spec["expr"]
        # Quote if not already quoted
        if not (expr.startswith('"') and expr.endswith('"')):
            expr = f'"{expr}"'
        field_lines.append(f"  expr: {expr}")
    if "domain" in field_spec and field_spec["domain"]:
        field_lines.append(f"  domain: {field_spec['domain']}")
    if "rankOut" in field_spec and field_spec["rankOut"]:
        field_lines.append(f"  rankOut: {field_spec['rankOut']}")

    blocks.append("field {\n" + "\n".join(field_lines) + "\n}")

    # 2. ops { ... }
    if ops_list:
        ops_lines = [f"  {op}" for op in ops_list]
        blocks.append("ops {\n" + "\n".join(ops_lines) + "\n}")

    # 3. view { ... }
    if view_layers:
        view_lines = [f"  {layer}" for layer in view_layers]
        blocks.append("view {\n" + "\n".join(view_lines) + "\n}")

    # 4. sample { ... }
    if sample_spec:
        sample_lines = []
        if "res" in sample_spec:
            sample_lines.append(f"  res: {sample_spec['res']}")
        if "box" in sample_spec and sample_spec["box"]:
            sample_lines.append(f"  box: {sample_spec['box']}")
        blocks.append("sample {\n" + "\n".join(sample_lines) + "\n}")

    return "\n\n".join(blocks)
