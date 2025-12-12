// app/api/progress/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await fetch(`${PYTHON_API_URL}/progress/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { 
          progress: 0, 
          status: 'error', 
          error: data.detail || 'Помилка отримання прогресу' 
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      progress: data.progress,
      status: data.status,
      downloadUrl: data.download_url,
      error: data.error,
      removed: data.removed,
    });
  } catch (error) {
    console.error('Помилка в API /progress:', error);
    return NextResponse.json(
      { 
        progress: 0, 
        status: 'error', 
        error: 'Помилка з\'єднання з сервером' 
      },
      { status: 500 }
    );
  }
}