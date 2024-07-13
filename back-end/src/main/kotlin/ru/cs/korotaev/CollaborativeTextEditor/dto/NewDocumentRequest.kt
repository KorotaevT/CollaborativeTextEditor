package ru.cs.korotaev.CollaborativeTextEditor.dto

data class NewDocumentRequest(
    val name: String,
    val creatorId: Long
)
