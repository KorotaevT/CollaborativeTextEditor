package ru.cs.korotaev.CollaborativeTextEditor.repository

import org.springframework.data.jpa.repository.JpaRepository
import ru.cs.korotaev.CollaborativeTextEditor.model.Document

interface DocumentRepository : JpaRepository<Document, Long> {

    fun findByCreatorUsername(username: String): List<Document>

}
