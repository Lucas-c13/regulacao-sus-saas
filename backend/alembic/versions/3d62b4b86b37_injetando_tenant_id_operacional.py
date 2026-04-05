"""injetando_tenant_id_operacional

Revision ID: 3d62b4b86b37
Revises: bbbffe68b211
Create Date: 2026-04-05 14:17:17.575393

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3d62b4b86b37'
down_revision: Union[str, Sequence[str], None] = 'bbbffe68b211'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # 1. Criação da tabela de auditoria
    op.create_table('log_auditoria',
    sa.Column('id_log', sa.Uuid(), nullable=False),
    sa.Column('id_usuario', sa.Uuid(), nullable=True),
    sa.Column('id_municipio', sa.Uuid(), nullable=True),
    sa.Column('metodo', sa.String(length=10), nullable=False),
    sa.Column('endpoint', sa.String(length=255), nullable=False),
    sa.Column('ip_origem', sa.String(length=50), nullable=False),
    sa.Column('status_code', sa.Integer(), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('dt_log', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['id_municipio'], ['municipios.id_municipio'], ),
    sa.ForeignKeyConstraint(['id_usuario'], ['profissionais.id_profissional'], ),
    sa.PrimaryKeyConstraint('id_log')
    )

    # ---------------------------------------------------------
    # VARIÁVEL DE MIGRAÇÃO: Insira o UUID de um Município existente
    # ---------------------------------------------------------
    municipio_padrao = 'bb41877c-0867-4f22-a755-4e399714bc58'

    # --- TABELA: agenda_central ---
    op.add_column('agenda_central', sa.Column('id_municipio', sa.Uuid(), nullable=True))
    op.execute(f"UPDATE agenda_central SET id_municipio = '{municipio_padrao}'")
    op.alter_column('agenda_central', 'id_municipio', nullable=False)
    op.create_foreign_key('fk_agenda_municipio', 'agenda_central', 'municipios', ['id_municipio'], ['id_municipio'])

    # --- TABELA: escala_central ---
    op.add_column('escala_central', sa.Column('id_municipio', sa.Uuid(), nullable=True))
    op.execute(f"UPDATE escala_central SET id_municipio = '{municipio_padrao}'")
    op.alter_column('escala_central', 'id_municipio', nullable=False)
    op.create_foreign_key('fk_escala_municipio', 'escala_central', 'municipios', ['id_municipio'], ['id_municipio'])
    
    op.add_column('escala_central', sa.Column('sn_ativo', sa.Boolean(), nullable=True))
    op.execute("UPDATE escala_central SET sn_ativo = true")
    op.alter_column('escala_central', 'sn_ativo', nullable=False)

    # --- TABELA: it_agenda_central ---
    op.add_column('it_agenda_central', sa.Column('id_municipio', sa.Uuid(), nullable=True))
    op.execute(f"UPDATE it_agenda_central SET id_municipio = '{municipio_padrao}'")
    op.alter_column('it_agenda_central', 'id_municipio', nullable=False)
    op.create_foreign_key('fk_it_agenda_municipio', 'it_agenda_central', 'municipios', ['id_municipio'], ['id_municipio'])
    
    op.alter_column('it_agenda_central', 'tp_situacao',
               existing_type=sa.VARCHAR(length=1),
               type_=sa.String(length=2),
               existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    
    op.drop_constraint('fk_it_agenda_municipio', 'it_agenda_central', type_='foreignkey')
    op.alter_column('it_agenda_central', 'tp_situacao',
               existing_type=sa.String(length=2),
               type_=sa.VARCHAR(length=1),
               existing_nullable=True)
    op.drop_column('it_agenda_central', 'id_municipio')
    
    op.drop_constraint('fk_escala_municipio', 'escala_central', type_='foreignkey')
    op.drop_column('escala_central', 'sn_ativo')
    op.drop_column('escala_central', 'id_municipio')
    
    op.drop_constraint('fk_agenda_municipio', 'agenda_central', type_='foreignkey')
    op.drop_column('agenda_central', 'id_municipio')
    
    op.drop_table('log_auditoria')