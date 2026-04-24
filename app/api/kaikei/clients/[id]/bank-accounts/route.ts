import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params
  const db = getServiceClient()

  const { data, error: err } = await db
    .from('kaikei_bank_accounts')
    .select('*')
    .eq('client_id', id)
    .eq('is_active', true)
    .order('bank_name')

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params
  const body = await req.json()
  const db = getServiceClient()

  const { data, error: err } = await db
    .from('kaikei_bank_accounts')
    .insert({ ...body, client_id: id })
    .select()
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id: clientId } = await params
  const { account_id } = await req.json()
  const db = getServiceClient()

  const { error: err } = await db
    .from('kaikei_bank_accounts')
    .update({ is_active: false })
    .eq('id', account_id)
    .eq('client_id', clientId)

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
