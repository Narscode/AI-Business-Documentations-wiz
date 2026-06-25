"""add modes to assessment

Revision ID: 001
Revises: None
Create Date: 2026-06-25 13:30:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '''001'''
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('''assessments''', sa.Column('''exam_mode''', sa.String(length=20), server_default='''practice''', nullable=False))
    op.add_column('''assessments''', sa.Column('''deadline_at''', sa.DateTime(), nullable=True))
    op.add_column('''assessments''', sa.Column('''attempt_limit''', sa.Integer(), nullable=True))
    op.add_column('''assessments''', sa.Column('''show_answers''', sa.Boolean(), server_default='''true''', nullable=False))
    op.add_column('''assessments''', sa.Column('''show_explanations''', sa.Boolean(), server_default='''true''', nullable=False))


def downgrade():
    op.drop_column('''assessments''', '''show_explanations''')
    op.drop_column('''assessments''', '''show_answers''')
    op.drop_column('''assessments''', '''attempt_limit''')
    op.drop_column('''assessments''', '''deadline_at''')
    op.drop_column('''assessments''', '''exam_mode''')
