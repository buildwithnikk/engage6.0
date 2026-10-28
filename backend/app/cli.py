"""Administrative CLI commands for Sahayak.

Usage:
    python -m app.cli create-admin [--email EMAIL] [--role {admin,reviewer,editor}]
    python -m app.cli change-role --email EMAIL --role {admin,reviewer,editor}
"""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy import func, select

from app.db.session import get_db
from app.models.admin_user import ADMIN_ROLES, AdminUser
from app.models.audit_event import AuditEvent
from app.services.admin.authentication import create_admin_user
from app.services.import_pipeline import registry


def create_admin_command(args: argparse.Namespace) -> int:
    email = args.email
    if not email:
        email = input("Admin email: ").strip()
    if not email or "@" not in email:
        sys.stderr.write("error: valid email is required\n")
        return 1

    role = args.role
    if role not in ADMIN_ROLES:
        sys.stderr.write(f"error: role must be one of {ADMIN_ROLES}\n")
        return 1

    if args.password_stdin:
        password = sys.stdin.readline().rstrip("\r\n")
    else:
        password = getpass.getpass("Admin password (min 8 chars): ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            sys.stderr.write("error: passwords do not match\n")
            return 1

    if len(password) < 8:
        sys.stderr.write("error: password must be at least 8 characters\n")
        return 1

    for session in get_db():
        try:
            with session.begin():
                user = create_admin_user(session, email=email, password=password, role=role)
                print(f"Admin user '{user.email}' created with role '{user.role}' (id={user.id}).")
                return 0
        except Exception as exc:
            sys.stderr.write(f"error: {exc}\n")
            return 1
    return 1


def change_role_command(args: argparse.Namespace) -> int:
    email = args.email.strip().lower()
    role = args.role
    if role not in ADMIN_ROLES:
        sys.stderr.write(f"error: role must be one of {ADMIN_ROLES}\n")
        return 1

    for session in get_db():
        try:
            with session.begin():
                stmt = select(AdminUser).where(
                    func.lower(func.trim(AdminUser.email)) == email
                )
                user = session.execute(stmt).scalars().first()
                if user is None:
                    sys.stderr.write(f"error: admin user '{email}' not found\n")
                    return 1

                old_role = user.role
                user.role = role
                audit = AuditEvent(
                    actor_admin_id=user.id,
                    action="admin_role_changed",
                    resource_type="admin_user",
                    resource_id=user.id,
                    metadata_json={"email": user.email, "old_role": old_role, "new_role": role},
                )
                session.add(audit)
                print(f"Role for '{user.email}' changed from '{old_role}' to '{role}'.")
                return 0
        except Exception as exc:
            sys.stderr.write(f"error: {exc}\n")
            return 1
    return 1


def import_schemes_command(args: argparse.Namespace) -> int:
    source_key = args.source_key
    adapter_cls = registry.ADAPTERS.get(source_key)
    if not adapter_cls:
        sys.stderr.write(f"error: invalid source key '{source_key}'. Available: {list(registry.ADAPTERS.keys())}\n")
        return 1

    for session in get_db():
        try:
            with session.begin():
                adapter = adapter_cls()
                candidates = registry.run_adapter_import(session, adapter)
                print(f"Imported {len(candidates)} candidate(s) from source '{adapter.name}'.")
                return 0
        except Exception as exc:
            sys.stderr.write(f"error: {exc}\n")
            return 1
    return 1


def seed_pilot_command(args: argparse.Namespace) -> int:
    for session in get_db():
        try:
            with session.begin():
                # Get or create an admin actor for audit attribution
                stmt = select(AdminUser).where(AdminUser.is_active.is_(True)).order_by(AdminUser.created_at.asc())
                actor = session.execute(stmt).scalars().first()
                if actor is None:
                    actor = create_admin_user(session, email="system.importer@sahayak.gov.in", password="Password123!", role="admin")

                total_staged = 0
                total_promoted = 0

                for key, cls in registry.ADAPTERS.items():
                    adapter = cls()
                    candidates = registry.run_adapter_import(session, adapter)
                    total_staged += len(candidates)
                    for c in candidates:
                        scheme = registry.promote_candidate_to_scheme(session, c.id, actor)
                        total_promoted += 1
                        print(f"Staged & promoted real pilot scheme '{scheme.official_name}' (status={scheme.review_status}, jurisdiction={scheme.jurisdiction}, state={scheme.state_code}).")

                print(f"\nReal pilot seed complete: {total_staged} candidate(s) staged, {total_promoted} scheme(s) ready in draft for admin review.")
                return 0
        except Exception as exc:
            sys.stderr.write(f"error: {exc}\n")
            return 1
    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Sahayak administrative CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_p = subparsers.add_parser("create-admin", help="Bootstrap or add an admin user")
    create_p.add_argument("--email", help="Admin email address")
    create_p.add_argument(
        "--role",
        choices=ADMIN_ROLES,
        default="admin",
        help="Account role (default: admin)",
    )
    create_p.add_argument(
        "--password-stdin",
        action="store_true",
        help="Read password from stdin instead of terminal prompt",
    )
    create_p.set_defaults(func=create_admin_command)

    role_p = subparsers.add_parser("change-role", help="Change role for an admin user")
    role_p.add_argument("--email", required=True, help="Admin email address")
    role_p.add_argument("--role", choices=ADMIN_ROLES, required=True, help="New role")
    role_p.set_defaults(func=change_role_command)

    import_p = subparsers.add_parser("import-schemes", help="Run adapter to import government schemes")
    import_p.add_argument("--source-key", choices=list(registry.ADAPTERS.keys()), required=True, help="Source adapter key")
    import_p.set_defaults(func=import_schemes_command)

    seed_p = subparsers.add_parser("seed-pilot", help="Import and stage real central scholarship & Haryana schemes")
    seed_p.set_defaults(func=seed_pilot_command)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
