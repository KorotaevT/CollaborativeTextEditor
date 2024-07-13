package ru.cs.korotaev.CollaborativeTextEditor.dto

data class DocumentUpdate(val id: Long, val name: String, val content: String, val creatorUsername: String)