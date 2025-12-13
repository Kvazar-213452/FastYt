import { NextRequest, NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { url, settings } = await request.json();

    if (!url || !url.trim()) {
      return NextResponse.json(
        { success: false, error: 'URL відсутня' },
        { status: 400 }
      );
    }

    // Відправка запиту до Python мікросервісу з налаштуваннями
    const response = await fetch(`${PYTHON_API_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, settings }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.detail || 'Помилка завантаження' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      message: data.message,
    });
  } catch (error) {
    console.error('Помилка в API /download:', error);
    return NextResponse.json(
      { success: false, error: 'Помилка сервера' },
      { status: 500 }
    );
  }
}